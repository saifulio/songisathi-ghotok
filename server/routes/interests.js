// Interests: the ghotok's inbox of requests other managers have sent about
// profiles in their book, and the sending of one — which a ghotok, a guardian,
// and a self-managed candidate all do, on behalf of a profile they manage.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { actingProfile } from '../lib/accounts.js';
import { INTEREST_SELECT, interestItem, interestById } from '../lib/interests.js';
import { markPairInDiscussion } from '../lib/profiles.js';
import { ghotokOnly, managerOnly } from '../middleware.js';

const router = express.Router();

// A profile is only worth putting forward while it is published and still
// looking — a draft has no PRN and nobody can open it.
const NOT_PUTTABLE = ['DRAFT', 'MARRIED', 'AUTO_ARCHIVED'];

// Who this interest comes from: the profile being put forward, and how the
// sender is recorded against it. A ghotok names one of their book (they hold
// many); a guardian or candidate acts for the profile they hold standing over.
// Replies and returns null when the request cannot name a sender.
async function senderFor(req, res) {
  if (req.auth.role === 'GHOTOK') {
    const fromProfileId = Number(req.body?.fromProfileId);
    if (!fromProfileId) {
      bad(res, 'fromProfileId is required — say which of your candidates this is on behalf of.');
      return null;
    }
    const profile = await queryOne(
      'SELECT * FROM profiles WHERE id = ? AND managedByGhotokId = ? LIMIT 1',
      [fromProfileId, req.ghotok.id]
    );
    if (!profile) {
      bad(res, 'That profile is not in your book.', 403);
      return null;
    }
    if (NOT_PUTTABLE.includes(profile.status)) {
      bad(res, 'Only a published, still-active profile can be put forward.');
      return null;
    }
    const user = await queryOne('SELECT fullName FROM users WHERE id = ?', [req.ghotok.userId]);
    return {
      profile,
      ghotokId: req.ghotok.id,
      guardianId: null,
      label: `${user?.fullName || 'Ghotok'} · ${req.ghotok.code}, ${req.ghotok.district}`,
    };
  }

  const me = actingProfile(req, res, 'sends interest on your behalf.');
  if (!me) return null;
  if (req.auth.role === 'GUARDIAN') {
    if (!req.guardian) {
      bad(res, 'No guardian profile is linked to this account.', 403);
      return null;
    }
    const user = await queryOne('SELECT fullName FROM users WHERE id = ?', [req.auth.sub]);
    return {
      profile: me.profile,
      ghotokId: null,
      guardianId: req.guardian.id,
      label: `Guardian — ${user?.fullName || ''}`.trim(),
    };
  }
  return { profile: me.profile, ghotokId: null, guardianId: null, label: `${me.profile.fullName} (self)` };
}

// ── send interest ──
// body: { targetProfileId, message?, fromProfileId? (ghotok), profileId? (member) }
// The same act from either chair: one manager putting their candidate to
// another manager's. Until now only a member could do it — POST wrote
// fromGhotokId = NULL unconditionally, so a ghotok could receive and decide but
// never open a conversation, and every ghotok-sent row in the product came
// from the seed.
router.post('/interests', managerOnly, async (req, res) => {
  const from = await senderFor(req, res);
  if (!from) return;

  const targetProfileId = Number(req.body?.targetProfileId);
  if (!targetProfileId) return bad(res, 'targetProfileId is required.');
  if (targetProfileId === from.profile.id) return bad(res, 'You cannot send interest to your own profile.');
  // A guardian matchmaking for two family members cannot introduce them to
  // each other. A ghotok holding both sides can — that is their whole job —
  // so this only applies to the member chair.
  if (req.auth.role !== 'GHOTOK' && req.myProfiles.some((p) => p.id === targetProfileId)) {
    return bad(res, 'You cannot send interest to a profile you manage yourself.');
  }

  const target = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [targetProfileId]);
  if (!target) return bad(res, 'Profile not found.', 404);
  // Only a profile the sender could have found: the same visibility rule the
  // searches read, so an id typed by hand reaches nothing a search would hide.
  const visible = target.status === 'ACTIVE'
    && (Boolean(target.inNetworkPool) || (req.ghotok && target.managedByGhotokId === req.ghotok.id));
  if (!visible) return bad(res, 'That profile is not open to interest right now.', 403);
  if (target.gender === from.profile.gender) {
    return bad(res, 'Interest goes to a bride or a groom on the other side of the match.');
  }

  const already = await queryOne(
    "SELECT id FROM interests WHERE theirProfileId = ? AND yourProfileId = ? AND kind = 'INTEREST' AND status = 'PENDING' LIMIT 1",
    [from.profile.id, targetProfileId]
  );
  if (already) return bad(res, 'Interest already sent and awaiting a reply.', 409);

  const message = String(req.body?.message || '').trim() || null;
  const newId = await withTransaction((tx) => insert(
    tx,
    `INSERT INTO interests (kind, fromGhotokId, fromGuardianId, fromLabel, theirProfileId, yourProfileId, status, message)
     VALUES ('INTEREST', ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [from.ghotokId, from.guardianId, from.label, from.profile.id, targetProfileId, message]
  ));
  return res.status(201).json({ interest: await interestById(newId) });
});

router.get('/interests', ghotokOnly, async (req, res) => {
  const rows = await query(
    `${INTEREST_SELECT} WHERE yp.managedByGhotokId = ? ORDER BY i.createdAt DESC`,
    [req.ghotok.id]
  );
  return res.json({ interests: rows.map(interestItem) });
});

// ── decide on an interest ──
// body: { status: 'ACCEPTED' | 'DECLINED' | 'EXPIRED', declineReason? }
//   ACCEPTED — nudges both candidates into "in discussion" (interest requests only).
//   DECLINED — requires declineReason; the other manager only sees the reason, never your candidate's name.
//   EXPIRED  — "hold for a week"; the other manager sees "under consideration".
router.patch('/interests/:id', ghotokOnly, async (req, res) => {
  const status = req.body?.status;
  if (!['ACCEPTED', 'DECLINED', 'EXPIRED'].includes(status)) return bad(res, 'status must be ACCEPTED, DECLINED, or EXPIRED.');
  const declineReason = status === 'DECLINED' ? String(req.body?.declineReason || '').trim() : null;
  if (status === 'DECLINED' && !declineReason) return bad(res, 'A decline reason is required.');

  const owned = await queryOne(
    `SELECT i.id, i.kind, i.theirProfileId, i.yourProfileId
       FROM interests i JOIN profiles yp ON i.yourProfileId = yp.id
      WHERE i.id = ? AND yp.managedByGhotokId = ? LIMIT 1`,
    [req.params.id, req.ghotok.id]
  );
  if (!owned) return bad(res, 'Request not found.', 404);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE interests SET status = ?, declineReason = ? WHERE id = ?', [status, declineReason, owned.id]);
    if (status === 'ACCEPTED' && owned.kind === 'INTEREST') {
      await markPairInDiscussion(tx, owned.theirProfileId, owned.yourProfileId);
    }
  });

  return res.json({ interest: await interestById(owned.id) });
});

export default router;
