// The commission ledger: which pairs can be closed, and recording a marriage.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { ghotokOnly } from '../middleware.js';

const router = express.Router();

const marriageRow = (m) => ({
  id: m.id, pair: m.pairLabel, prns: m.prns, date: m.weddingDate,
  agreed: m.agreedAmount, received: m.receivedAmount, status: m.status,
});

// ── commission ledger ──
router.get('/marriages', ghotokOnly, async (req, res) => {
  const rows = await query('SELECT * FROM marriages WHERE ghotokId = ? ORDER BY weddingDate DESC', [req.ghotok.id]);
  return res.json({ marriages: rows.map(marriageRow) });
});

// ── pairs this ghotok could record as married ──
// Sourced from the two places a pair becomes "in progress": an AI-matching
// suggestion this ghotok accepted, or an inbound interest accepted on one of
// their own profiles. Already-married pairs are excluded.
router.get('/marriages/closable-pairs', ghotokOnly, async (req, res) => {
  const [fromSuggestions, fromInterests] = await Promise.all([
    query(
      "SELECT id AS srcId, 'suggestion' AS src, profileAId, profileBId, createdAt FROM match_suggestions WHERE ghotokId = ? AND status = 'ACCEPTED'",
      [req.ghotok.id]
    ),
    query(
      `SELECT i.id AS srcId, 'interest' AS src, i.theirProfileId AS profileAId, i.yourProfileId AS profileBId, i.createdAt
         FROM interests i JOIN profiles yp ON i.yourProfileId = yp.id
        WHERE yp.managedByGhotokId = ? AND i.status = 'ACCEPTED' AND i.kind = 'INTEREST'`,
      [req.ghotok.id]
    ),
  ]);

  const seen = new Map();
  for (const row of [...fromSuggestions, ...fromInterests]) {
    const key = [row.profileAId, row.profileBId].sort((x, y) => x - y).join('-');
    if (!seen.has(key)) seen.set(key, row);
  }
  const candidates = [...seen.values()];
  if (!candidates.length) return res.json({ pairs: [] });

  const profileIds = [...new Set(candidates.flatMap((c) => [c.profileAId, c.profileBId]))];
  const profiles = await query(
    `SELECT id, fullName, prn, status FROM profiles WHERE id IN (${profileIds.map(() => '?').join(',')})`,
    profileIds
  );
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const STATE_LABEL = { MATCH_IN_PROGRESS: 'Match in progress', IN_DISCUSSION: 'In discussion' };

  const pairs = candidates
    .map((c) => {
      const a = byId[c.profileAId];
      const b = byId[c.profileBId];
      if (!a || !b || a.status === 'MARRIED' || b.status === 'MARRIED') return null;
      return {
        id: `${c.src}-${c.srcId}`,
        profileAId: a.id, profileBId: b.id,
        pair: `${a.fullName} ↔ ${b.fullName}`,
        prns: `${a.prn || '—'} · ${b.prn || '—'}`,
        since: c.createdAt,
        state: STATE_LABEL[a.status] || STATE_LABEL[b.status] || 'Introduced',
      };
    })
    .filter(Boolean);

  return res.json({ pairs });
});

// ── record a marriage ──
// Closes both profiles out of matching, logs the commission, and adds one to
// the ghotok's lifetime count.
// body: { profileAId, profileBId, brideFee, groomFee, weddingDate, paidFull }
router.post('/marriages', ghotokOnly, async (req, res) => {
  const b = req.body || {};
  const profileAId = Number(b.profileAId);
  const profileBId = Number(b.profileBId);
  if (!profileAId || !profileBId) return bad(res, 'Choose which pair you are closing.');
  const brideFee = Math.max(0, Number(b.brideFee) || 0);
  const groomFee = Math.max(0, Number(b.groomFee) || 0);
  const weddingDate = new Date(b.weddingDate);
  if (Number.isNaN(weddingDate.getTime())) return bad(res, 'Wedding date is invalid.');

  const [profileA, profileB] = await Promise.all([
    queryOne('SELECT id, fullName, prn, managedByGhotokId FROM profiles WHERE id = ?', [profileAId]),
    queryOne('SELECT id, fullName, prn, managedByGhotokId FROM profiles WHERE id = ?', [profileBId]),
  ]);
  if (!profileA || !profileB) return bad(res, 'Profile not found.', 404);
  if (profileA.managedByGhotokId !== req.ghotok.id && profileB.managedByGhotokId !== req.ghotok.id)
    return bad(res, 'At least one profile must be in your book.', 403);

  const agreedAmount = brideFee + groomFee;
  const receivedAmount = b.paidFull ? agreedAmount : 0;
  const status = receivedAmount >= agreedAmount && agreedAmount > 0 ? 'PAID' : receivedAmount > 0 ? 'PART_PAID' : 'UNPAID';
  const pairLabel = `${profileA.fullName} ↔ ${profileB.fullName}`;
  const prns = `${profileA.prn || '—'} · ${profileB.prn || '—'}`;

  const { marriageId } = await withTransaction(async (tx) => {
    const id = await insert(
      tx,
      `INSERT INTO marriages (ghotokId, pairLabel, prns, weddingDate, brideFee, groomFee, agreedAmount, receivedAmount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.ghotok.id, pairLabel, prns, weddingDate, brideFee, groomFee, agreedAmount, receivedAmount, status]
    );
    await tx.execute("UPDATE profiles SET status = 'MARRIED' WHERE id IN (?, ?)", [profileAId, profileBId]);
    await tx.execute('UPDATE ghotoks SET marriagesClosed = marriagesClosed + 1 WHERE id = ?', [req.ghotok.id]);
    return { marriageId: id };
  });

  const m = await queryOne('SELECT * FROM marriages WHERE id = ?', [marriageId]);
  const updatedGhotok = await queryOne('SELECT marriagesClosed FROM ghotoks WHERE id = ?', [req.ghotok.id]);
  return res.status(201).json({
    marriage: marriageRow(m),
    marriagesClosed: updatedGhotok.marriagesClosed,
  });
});

export default router;
