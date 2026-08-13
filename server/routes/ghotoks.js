// Hiring a matchmaker: the directory a family searches, the request they send
// asking a ghotok to take their profile on for the fee that ghotok publishes,
// and the ghotok's side of the same request.
//
// This is the other direction from routes/interests.js. There, two managers
// talk about a match; here, a family that has been running its own profile
// asks someone to run it for them. Accepting is what moves the profile into
// the ghotok's book — nothing else in the app does that, so it happens once,
// here, in a transaction, against the same plan limit publishing is held to.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { actingProfile, hasStanding } from '../lib/accounts.js';
import { planFullRefusal } from '../lib/profiles.js';
import {
  GHOTOK_DIRECTORY_SELECT, ghotokCard,
  MANAGEMENT_REQUEST_SELECT, managementRequestItem, managementRequestById,
} from '../lib/ghotoks.js';
import { memberOnly, ghotokOnly } from '../middleware.js';

const router = express.Router();

// A profile worth handing over: published, and not already finished with.
// A draft has no PRN and nothing for a matchmaker to work from — publish it
// first, the same order the rest of the app asks for.
const NOT_HANDABLE = {
  DRAFT: 'Publish the profile first — a draft has no biodata a matchmaker could work from.',
  MARRIED: 'This profile is closed. There is nothing left to manage.',
  AUTO_ARCHIVED: 'This profile has lapsed. Confirm it is still looking before asking anyone to take it on.',
};

// ── the directory ──
// Every matchmaker a family may approach, their own district first — "nearby"
// is district-level because that is the granularity a ghotok publishes and
// the only one a family judges by. ?district= narrows it further, ?q= searches
// the name, bureau and code.
//
// Readable by any member account, including a candidate whose profile someone
// else manages: looking up who is out there is not acting on anything. Sending
// is where standing is required.
router.get('/ghotoks', memberOnly, async (req, res) => {
  const me = req.me;
  const homeDistrict = me?.profile.district || null;

  const where = [];
  const params = [];
  const district = String(req.query?.district || '').trim();
  if (district) { where.push('g.district = ?'); params.push(district); }
  const q = String(req.query?.q || '').trim();
  if (q) {
    where.push('(u.fullName LIKE ? OR g.bureauName LIKE ? OR g.code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const rows = await query(
    `${GHOTOK_DIRECTORY_SELECT}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY g.district = ? DESC, g.verified DESC, g.marriagesClosed DESC`,
    [...params, homeDistrict || '']
  );

  // This profile's own requests, so a card can say "you already asked" rather
  // than offering a button the POST below would refuse.
  const byGhotok = {};
  if (me) {
    const mine = await query(
      `${MANAGEMENT_REQUEST_SELECT} WHERE m.profileId = ? ORDER BY m.createdAt DESC`,
      [me.profile.id]
    );
    for (const r of mine) {
      const item = managementRequestItem(r);
      byGhotok[item.ghotokId] ??= item; // newest first, so the first wins
    }
  }

  return res.json({
    ghotoks: rows.map((r) => ghotokCard(r, homeDistrict, byGhotok[r.id] || null)),
    homeDistrict,
    // Districts with a matchmaker in them, for the filter — offering one that
    // returns nothing is worse than not offering it.
    districts: [...new Set(rows.map((r) => r.district))].sort(),
    // Who the profile is with today, so the page can explain what a request
    // would change (or that there is nothing to change).
    managerType: me ? me.profile.managerType : null,
    // A managed candidate may read the directory but not hire from it — the
    // same standing rule the rest of the member API applies, reported so the
    // page renders what the POST would allow.
    canRequest: Boolean(me) && hasStanding(req, me),
  });
});

// ── the requests this profile has sent ──
router.get('/ghotok-requests', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ requests: [] });
  const rows = await query(
    `${MANAGEMENT_REQUEST_SELECT} WHERE m.profileId = ? ORDER BY m.createdAt DESC`,
    [me.profile.id]
  );
  return res.json({ requests: rows.map(managementRequestItem) });
});

// ── ask a ghotok to take this profile on ──
// body: { ghotokId, message?, profileId? }
// The fee is not negotiated here: it is whatever the ghotok publishes at the
// moment of asking, copied onto the row so a later price change cannot rewrite
// what was agreed. A ghotok who has published nothing (serviceFee 0) is asked
// on the understanding that the figure comes from them.
router.post('/ghotok-requests', memberOnly, async (req, res) => {
  const me = actingProfile(req, res, 'decides who manages your profile.');
  if (!me) return;

  const ghotokId = Number(req.body?.ghotokId);
  if (!ghotokId) return bad(res, 'ghotokId is required — say which matchmaker you are asking.');

  const refusal = NOT_HANDABLE[me.profile.status];
  if (refusal) return bad(res, refusal);
  if (me.profile.managedByGhotokId) {
    return bad(
      res,
      'A matchmaker already runs this profile. Ask them to release it before approaching someone else.',
      409
    );
  }

  const ghotok = await queryOne('SELECT * FROM ghotoks WHERE id = ? LIMIT 1', [ghotokId]);
  if (!ghotok) return bad(res, 'Matchmaker not found.', 404);

  // One request at a time, to one matchmaker. Asking three at once and having
  // two say yes leaves a family owing two fees for one profile — the answer is
  // to wait for the first, or withdraw it.
  const pending = await queryOne(
    "SELECT id FROM management_requests WHERE profileId = ? AND status = 'PENDING' LIMIT 1",
    [me.profile.id]
  );
  if (pending) {
    return bad(
      res,
      'This profile already has a request waiting on a matchmaker. Withdraw it first if you would rather ask someone else.',
      409
    );
  }

  const message = String(req.body?.message || '').trim() || null;
  const newId = await withTransaction((tx) => insert(
    tx,
    `INSERT INTO management_requests (profileId, ghotokId, requestedByUserId, feeAmount, status, message)
     VALUES (?, ?, ?, ?, 'PENDING', ?)`,
    [me.profile.id, ghotok.id, req.auth.sub, ghotok.serviceFee, message]
  ));

  return res.status(201).json({ request: await managementRequestById(newId) });
});

// ── withdraw a request (family) ──
// Only while it is still pending: once a ghotok has answered there is nothing
// to take back, and a declined row is the family's own record of asking.
router.delete('/ghotok-requests/:id', memberOnly, async (req, res) => {
  const me = actingProfile(req, res, 'decides who manages your profile.');
  if (!me) return;

  const row = await queryOne(
    'SELECT * FROM management_requests WHERE id = ? AND profileId = ? LIMIT 1',
    [req.params.id, me.profile.id]
  );
  if (!row) return bad(res, 'Request not found.', 404);
  if (row.status !== 'PENDING') return bad(res, 'That request has already been answered.', 409);

  await query(
    "UPDATE management_requests SET status = 'WITHDRAWN', decidedAt = ? WHERE id = ?",
    [new Date(), row.id]
  );
  return res.json({ request: await managementRequestById(row.id) });
});

// ── the ghotok's side: families asking to join their book ──
router.get('/ghotok-requests/inbox', ghotokOnly, async (req, res) => {
  const rows = await query(
    `${MANAGEMENT_REQUEST_SELECT} WHERE m.ghotokId = ? ORDER BY m.createdAt DESC`,
    [req.ghotok.id]
  );
  const used = await queryOne(
    "SELECT COUNT(*) AS n FROM profiles WHERE managedByGhotokId = ? AND status NOT IN ('DRAFT','MARRIED','AUTO_ARCHIVED')",
    [req.ghotok.id]
  );
  return res.json({
    requests: rows.map(managementRequestItem),
    // The plan meter, since accepting is what spends a place on it.
    plan: {
      tier: req.ghotok.tier,
      limit: req.ghotok.activeProfileLimit,
      used: Number(used?.n || 0),
      serviceFee: req.ghotok.serviceFee,
    },
  });
});

// ── decide on one (ghotok) ──
// body: { status: 'ACCEPTED' | 'DECLINED', declineReason? }
// Accepting hands the profile over: managerType becomes GHOTOK and the profile
// joins this book. A guardian's link is deliberately left in place — the
// mother who asked for help is still the mother, and taking the profile off
// her account would lock her out of her own daughter's biodata. What changes
// is who the app names as its matchmaker.
router.patch('/ghotok-requests/:id', ghotokOnly, async (req, res) => {
  const status = req.body?.status;
  if (!['ACCEPTED', 'DECLINED'].includes(status)) return bad(res, 'status must be ACCEPTED or DECLINED.');
  const declineReason = status === 'DECLINED' ? String(req.body?.declineReason || '').trim() : null;
  if (status === 'DECLINED' && !declineReason) return bad(res, 'A decline reason is required.');

  const row = await queryOne(
    'SELECT * FROM management_requests WHERE id = ? AND ghotokId = ? LIMIT 1',
    [req.params.id, req.ghotok.id]
  );
  if (!row) return bad(res, 'Request not found.', 404);
  if (row.status !== 'PENDING') return bad(res, 'That request has already been answered.', 409);

  const profile = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [row.profileId]);
  if (!profile) return bad(res, 'That profile no longer exists.', 404);

  if (status === 'ACCEPTED') {
    // The family may have found someone else while this sat in the inbox.
    if (profile.managedByGhotokId) {
      return bad(res, 'Another matchmaker has taken this profile on since the request was sent.', 409);
    }
    // Taking a family on fills a place on the plan, exactly as publishing a
    // profile of your own does — same definition, same refusal.
    const full = await planFullRefusal(req.ghotok);
    if (full) return bad(res, full, 409);
  }

  await withTransaction(async (tx) => {
    await tx.execute(
      'UPDATE management_requests SET status = ?, declineReason = ?, decidedAt = ? WHERE id = ?',
      [status, declineReason, new Date(), row.id]
    );
    if (status === 'ACCEPTED') {
      await tx.execute(
        "UPDATE profiles SET managerType = 'GHOTOK', managedByGhotokId = ?, lastUpdatedAt = ? WHERE id = ?",
        [req.ghotok.id, new Date(), profile.id]
      );
      await insert(
        tx,
        'INSERT INTO activity_log (ghotokId, profileId, text) VALUES (?, ?, ?)',
        [req.ghotok.id, profile.id, `Profile taken on by your matchmaker for ৳${row.feeAmount.toLocaleString('en-BD')}`]
      );
    }
  });

  return res.json({ request: await managementRequestById(row.id) });
});

export default router;
