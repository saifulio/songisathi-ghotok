// Generating a ghotok's AI match suggestions — the "Monday run".
//
// scoreMatch() (lib/matching.js) does the arithmetic and stays pure; this
// decides which pairs are worth scoring, which the ghotok has already been
// shown, and what gets written to match_suggestions / match_factors. Until
// this existed the table was only ever filled by db/seed.mjs, so a ghotok who
// worked through the seeded rows faced an empty console for good.

import { query, withTransaction, insert } from '../../db/pool.js';
import { scoreMatch } from './matching.js';

// A pair below this is not worth a ghotok's attention. There is no per-ghotok
// threshold column yet — when there is one, this reads from it.
export const SUGGESTION_THRESHOLD = 60;

// How many new pairs one run may add. A ghotok with twenty candidates has
// hundreds of possible pairs, and the product promises a short weekly digest
// rather than an inbox — the rest keep until the next run.
export const MAX_NEW_SUGGESTIONS = 5;

// The Monday that opens the current week. Every suggestion from a run is
// stamped with it; the console dates the run by it and counts to the next one.
export function mondayOf(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

// A pair is the two people in it, whichever way round it was stored.
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Score every pair this ghotok has not already been shown, and write the best
// of them. Returns what it added, so the caller can say so.
export async function runMatchingFor(ghotokId) {
  // Side A: the ghotok's own active candidates — the people they work for.
  const book = await query(
    "SELECT * FROM profiles WHERE managedByGhotokId = ? AND status = 'ACTIVE'",
    [ghotokId]
  );
  if (!book.length) return { created: 0, considered: 0 };

  // Side B: everyone side A could be introduced to. Same visibility rule as
  // the ghotok's search — their own book, plus the trusted-network pool — so
  // the console never suggests a profile they cannot open.
  const pool = await query(
    `SELECT * FROM profiles
      WHERE status = 'ACTIVE' AND (managedByGhotokId = ? OR inNetworkPool = 1)`,
    [ghotokId]
  );

  // Every pair already put to this ghotok, in any state. Accepted and
  // dismissed pairs must never come back — a dismissal is an answer, not a
  // skip — and an open one must not be offered twice.
  const seenRows = await query(
    'SELECT profileAId, profileBId FROM match_suggestions WHERE ghotokId = ?',
    [ghotokId]
  );
  const seen = new Set(seenRows.map((r) => pairKey(r.profileAId, r.profileBId)));

  // Who has sealed answers on file. Both sides sealed means the gate ran and
  // the pair came back compatible; anything less is "not compared", which is
  // what the console reports and all it is entitled to say.
  const sealed = new Set(
    (await query('SELECT DISTINCT profileId FROM screening_responses WHERE sealed = 1'))
      .map((r) => r.profileId)
  );

  const scored = [];
  let considered = 0;
  for (const mine of book) {
    for (const cand of pool) {
      if (cand.id === mine.id || cand.gender === mine.gender) continue;
      const key = pairKey(mine.id, cand.id);
      if (seen.has(key)) continue;
      seen.add(key); // two of the ghotok's own candidates would otherwise pair twice
      considered += 1;
      const { score, factors } = scoreMatch(mine, cand);
      if (score < SUGGESTION_THRESHOLD) continue;
      scored.push({ a: mine.id, b: cand.id, score, factors, screeningPassed: sealed.has(mine.id) && sealed.has(cand.id) });
    }
  }

  const top = scored.sort((x, y) => y.score - x.score).slice(0, MAX_NEW_SUGGESTIONS);
  if (!top.length) return { created: 0, considered };

  const weekOf = mondayOf();
  await withTransaction(async (tx) => {
    for (const s of top) {
      const suggestionId = await insert(
        tx,
        `INSERT INTO match_suggestions (ghotokId, weekOf, profileAId, profileBId, score, status, screeningPassed)
         VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
        [ghotokId, weekOf, s.a, s.b, s.score, s.screeningPassed]
      );
      for (const f of s.factors) {
        await insert(
          tx,
          'INSERT INTO match_factors (suggestionId, label, percentage, note) VALUES (?, ?, ?, ?)',
          [suggestionId, f.label, f.pct, f.note]
        );
      }
    }
  });

  return { created: top.length, considered };
}
