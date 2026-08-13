// The ghotok's interest inbox: requests other managers have sent about
// profiles in this ghotok's book.

import express from 'express';
import { query, queryOne, withTransaction } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { INTEREST_SELECT, interestItem, interestById } from '../lib/interests.js';
import { markPairInDiscussion } from '../lib/profiles.js';
import { ghotokOnly } from '../middleware.js';

const router = express.Router();

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
