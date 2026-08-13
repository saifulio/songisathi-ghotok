// Messages between the two managers of a matched pair.
//
// Every route here answers the same authorisation question — does this account
// speak for one of the two profiles in the thread? — which is why a candidate
// whose biodata someone else manages sees an empty list rather than a refusal:
// they speak for nothing, so there is nothing addressed to them.

import express from 'express';
import { query, queryOne, insert, withTransaction } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { relativeTime } from '../lib/format.js';
import {
  ensureConversationsFor, conversationForUser, speakerOf, managerLabelOf,
  contactDetailIn, contactReleased,
} from '../lib/conversations.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = express.Router();

// Anyone who can manage a profile. Whether they actually do is settled per
// conversation, not by role.
const messagingRoles = [requireAuth, requireRole('GHOTOK', 'GUARDIAN', 'CANDIDATE')];

const MAX_BODY = 2000;

// Who the other side is, in the terms this product uses about managers.
async function peerCard(theirs) {
  const user = await queryOne('SELECT fullName FROM users WHERE id = ?', [speakerOf(theirs)]);
  const label = managerLabelOf(theirs);
  return { name: user?.fullName || label.role, role: label.role, meta: label.meta };
}

// ── the caller's threads ──
router.get('/conversations', messagingRoles, async (req, res) => {
  const mine = await ensureConversationsFor(req.auth.sub);
  if (!mine.length) {
    // A managed candidate speaks for no profile: their manager holds the
    // conversation. Say so rather than showing an empty inbox.
    return res.json({ conversations: [], canMessage: false });
  }

  const ids = mine.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `SELECT * FROM conversations
      WHERE profileAId IN (${placeholders}) OR profileBId IN (${placeholders})
      ORDER BY id DESC`,
    [...ids, ...ids]
  );

  const conversations = [];
  for (const row of rows) {
    const ctx = await conversationForUser(row.id, req.auth.sub);
    if (!ctx) continue;
    const [last] = await query(
      'SELECT senderUserId, body, createdAt FROM messages WHERE conversationId = ? ORDER BY id DESC LIMIT 1',
      [row.id]
    );
    const unread = await queryOne(
      'SELECT COUNT(*) AS n FROM messages WHERE conversationId = ? AND senderUserId <> ? AND readAt IS NULL',
      [row.id, req.auth.sub]
    );
    conversations.push({
      id: row.id,
      peer: await peerCard(ctx.theirs),
      mine: { id: ctx.mine.id, name: ctx.mine.fullName, prn: ctx.mine.prn },
      theirs: { id: ctx.theirs.id, name: ctx.theirs.fullName, prn: ctx.theirs.prn },
      last: last ? { body: last.body, when: relativeTime(last.createdAt), fromMe: last.senderUserId === req.auth.sub } : null,
      unread: unread?.n ?? 0,
    });
  }

  return res.json({ conversations, canMessage: true });
});

// ── one thread ──
// Reading it marks the other side's messages read: opening a message is what
// "read" means, and there is no second signal to give.
router.get('/conversations/:id', messagingRoles, async (req, res) => {
  const ctx = await conversationForUser(req.params.id, req.auth.sub);
  if (!ctx) return bad(res, 'Conversation not found.', 404);

  await query(
    'UPDATE messages SET readAt = ? WHERE conversationId = ? AND senderUserId <> ? AND readAt IS NULL',
    [new Date(), ctx.conversation.id, req.auth.sub]
  );

  const rows = await query(
    `SELECT m.id, m.senderUserId, m.body, m.createdAt, u.fullName AS senderName
       FROM messages m JOIN users u ON u.id = m.senderUserId
      WHERE m.conversationId = ? ORDER BY m.id`,
    [ctx.conversation.id]
  );

  return res.json({
    conversation: {
      id: ctx.conversation.id,
      peer: await peerCard(ctx.theirs),
      mine: { id: ctx.mine.id, name: ctx.mine.fullName, prn: ctx.mine.prn },
      theirs: { id: ctx.theirs.id, name: ctx.theirs.fullName, prn: ctx.theirs.prn },
      contactReleased: await contactReleased(ctx.mine.id, ctx.theirs.id),
    },
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      when: relativeTime(m.createdAt),
      fromMe: m.senderUserId === req.auth.sub,
      senderName: m.senderName,
    })),
  });
});

// ── send ──
// body: { body }
router.post('/conversations/:id/messages', messagingRoles, async (req, res) => {
  const ctx = await conversationForUser(req.params.id, req.auth.sub);
  if (!ctx) return bad(res, 'Conversation not found.', 404);

  const body = String(req.body?.body || '').trim();
  if (!body) return bad(res, 'Write something first.');
  if (body.length > MAX_BODY) return bad(res, `A message runs to ${MAX_BODY} characters at most.`);

  // The sealed-contact rule, enforced where it can actually be broken.
  const found = contactDetailIn(body);
  if (found && !(await contactReleased(ctx.mine.id, ctx.theirs.id))) {
    return bad(
      res,
      `That message looks like it carries ${found}. Contact details move by a release both managers agree to, which is logged — not inside a message. Send a contact release request instead.`
    );
  }

  const id = await withTransaction((tx) => insert(
    tx,
    'INSERT INTO messages (conversationId, senderUserId, body) VALUES (?, ?, ?)',
    [ctx.conversation.id, req.auth.sub, body]
  ));
  const row = await queryOne(
    `SELECT m.id, m.body, m.createdAt, u.fullName AS senderName
       FROM messages m JOIN users u ON u.id = m.senderUserId WHERE m.id = ?`,
    [id]
  );

  return res.status(201).json({
    message: {
      id: row.id, body: row.body, when: relativeTime(row.createdAt), fromMe: true, senderName: row.senderName,
    },
  });
});

export default router;
