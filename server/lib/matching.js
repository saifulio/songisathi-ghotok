// A transparent, deterministic compatibility score against one candidate
// profile — not a learned model, but real arithmetic over real fields (no
// hardcoded pairs, unlike the ghotok console's mocked funnel/misses panels).

import { yearsSince, capWord, eduLevelOf } from './format.js';

export function scoreMatch(mine, cand) {
  const factors = [];
  const ageA = yearsSince(mine.dob);
  const ageB = yearsSince(cand.dob);
  const ageDiff = ageA != null && ageB != null ? Math.abs(ageA - ageB) : null;
  const agePct = ageDiff == null ? 50 : Math.max(20, 100 - ageDiff * 12);
  factors.push({ label: 'Age', pct: Math.round(agePct), note: ageDiff == null ? 'Age not on file' : `${ageDiff} year${ageDiff === 1 ? '' : 's'} apart` });

  const sameDistrict = mine.district && mine.district === cand.district;
  factors.push({ label: 'Location', pct: sameDistrict ? 92 : 55, note: sameDistrict ? `Both in ${mine.district}` : [mine.district, cand.district].filter(Boolean).join(' · ') });

  const eduMatch = eduLevelOf(mine.degree) === eduLevelOf(cand.degree);
  factors.push({ label: 'Education', pct: eduMatch ? 88 : 62, note: eduMatch ? `Both ${eduLevelOf(mine.degree).toLowerCase()}` : `${eduLevelOf(mine.degree)} · ${eduLevelOf(cand.degree)}` });

  const sameRel = mine.religiousPractice && mine.religiousPractice === cand.religiousPractice;
  factors.push({ label: 'Religious practice', pct: sameRel ? 90 : 60, note: sameRel ? mine.religiousPractice : 'Different stated practice' });

  const sameFam = mine.familyType && mine.familyType === cand.familyType;
  factors.push({ label: 'Family type', pct: sameFam ? 85 : 65, note: sameFam ? `Both ${capWord(mine.familyType)}` : 'Different family structure' });

  const score = Math.round(factors.reduce((n, f) => n + f.pct, 0) / factors.length);
  return { score, factors };
}
