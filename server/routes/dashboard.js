// The ghotok console's home: headline stats, AI match suggestions, and the
// testimonials rail.

import express from 'express';
import { query, queryOne, withTransaction } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { suggestionPerson, markPairInDiscussion } from '../lib/profiles.js';
import { runMatchingFor } from '../lib/suggestions.js';
import { ghotokOnly } from '../middleware.js';

const router = express.Router();

// This ghotok's open suggestions, each with its two people and the factor
// breakdown the run recorded for it.
async function openSuggestionsFor(ghotokId) {
  const sugs = await query(
    "SELECT * FROM match_suggestions WHERE ghotokId = ? AND status = 'OPEN' ORDER BY score DESC",
    [ghotokId]
  );
  const PEER_COLUMNS = 'SELECT fullName, dob, profession, area, district, degree, institution FROM profiles WHERE id = ?';
  const out = [];
  for (const s of sugs) {
    const [a, b, factors] = await Promise.all([
      queryOne(PEER_COLUMNS, [s.profileAId]),
      queryOne(PEER_COLUMNS, [s.profileBId]),
      query('SELECT label, percentage, note FROM match_factors WHERE suggestionId = ? ORDER BY id', [s.id]),
    ]);
    out.push({
      id: s.id,
      score: s.score,
      screeningPassed: Boolean(s.screeningPassed),
      weekOf: s.weekOf,
      a: a ? suggestionPerson(a) : null,
      b: b ? suggestionPerson(b) : null,
      factors: factors.map((f) => ({ label: f.label, pct: f.percentage, note: f.note })),
    });
  }
  return out;
}

// ── dashboard stats ──
router.get('/dashboard/stats', ghotokOnly, async (req, res) => {
  const { ghotok } = req;
  const countOne = async (sql, params) => (await queryOne(sql, params))?.n ?? 0;
  // "Active" = counts against the plan limit (anything not a draft, married, or archived).
  const activeProfiles = await countOne(
    "SELECT COUNT(*) AS n FROM profiles WHERE managedByGhotokId = ? AND status NOT IN ('DRAFT','MARRIED','AUTO_ARCHIVED')",
    [ghotok.id]
  );
  const matchesSuggested = await countOne(
    "SELECT COUNT(*) AS n FROM match_suggestions WHERE ghotokId = ? AND status = 'OPEN'",
    [ghotok.id]
  );
  const introductionsInProgress = await countOne(
    "SELECT COUNT(*) AS n FROM profiles WHERE managedByGhotokId = ? AND status IN ('IN_DISCUSSION','MATCH_IN_PROGRESS')",
    [ghotok.id]
  );
  const payments = await queryOne(
    "SELECT COUNT(*) AS total, SUM(status = 'PAID') AS paid, SUM(receivedAmount) AS received FROM marriages WHERE ghotokId = ?",
    [ghotok.id]
  );

  return res.json({
    stats: {
      activeProfiles,
      profileLimit: ghotok.activeProfileLimit,
      matchesSuggested,
      introductionsInProgress,
      marriagesClosed: ghotok.marriagesClosed,
      yearsActive: ghotok.yearsActive,
      commissionReceived: Number(payments?.received || 0),
      paymentsReceived: Number(payments?.paid || 0),
      paymentsTotal: Number(payments?.total || 0),
      tier: ghotok.tier,
      code: ghotok.code,
      referralCode: ghotok.referralCode,
    },
  });
});

// ── AI match suggestions (this ghotok's open suggestions) ──
// Opening the console tops the run up when nothing is open. There is no
// scheduler behind the weekly run in this codebase, so without this a ghotok
// who has decided on everything they were shown never sees another pair.
router.get('/match-suggestions', ghotokOnly, async (req, res) => {
  let suggestions = await openSuggestionsFor(req.ghotok.id);
  if (!suggestions.length) {
    await runMatchingFor(req.ghotok.id);
    suggestions = await openSuggestionsFor(req.ghotok.id);
  }
  return res.json({ suggestions });
});

// ── run the matcher now ──
// The console's "Run again now". Scores every pair the ghotok has not already
// been shown and keeps the best of them, so pressing it repeatedly works
// through the pool rather than repeating itself.
router.post('/match-suggestions/run', ghotokOnly, async (req, res) => {
  const { created, considered } = await runMatchingFor(req.ghotok.id);
  return res.json({ created, considered, suggestions: await openSuggestionsFor(req.ghotok.id) });
});

// ── act on a suggestion ──
// body: { status: 'ACCEPTED' | 'DISMISSED' }
// Accepting nudges both profiles into "in discussion".
router.patch('/match-suggestions/:id', ghotokOnly, async (req, res) => {
  const status = req.body?.status;
  if (!['ACCEPTED', 'DISMISSED'].includes(status)) return bad(res, 'status must be ACCEPTED or DISMISSED.');
  const sug = await queryOne('SELECT * FROM match_suggestions WHERE id = ? LIMIT 1', [req.params.id]);
  if (!sug) return bad(res, 'Suggestion not found.', 404);
  if (sug.ghotokId !== req.ghotok.id) return bad(res, 'That suggestion is not yours.', 403);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE match_suggestions SET status = ? WHERE id = ?', [status, sug.id]);
    if (status === 'ACCEPTED') await markPairInDiscussion(tx, sug.profileAId, sug.profileBId);
  });
  return res.json({ ok: true, status });
});

// ── testimonials (commission page rail) ──
router.get('/testimonials', ghotokOnly, async (req, res) => {
  const rows = await query(
    'SELECT quote, byLabel, monthLabel FROM testimonials WHERE ghotokId = ? ORDER BY createdAt DESC',
    [req.ghotok.id]
  );
  return res.json({ testimonials: rows });
});

export default router;
