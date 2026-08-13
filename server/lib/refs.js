// Human-facing reference codes: ghotok codes, profile reference numbers, and
// referral codes. Each scans what exists and increments the highest, with a
// floor so a fresh install starts at a sensible number.

import { query } from '../../db/pool.js';

// Highest number embedded in `column` across `rows`, ignoring the prefix.
const highestNumber = (rows, column) =>
  rows.reduce((max, r) => {
    const n = parseInt(String(r[column]).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

export async function nextGhotokCode() {
  const rows = await query('SELECT code FROM ghotoks');
  const next = Math.max(500, highestNumber(rows, 'code') + 1);
  return `GHT-${String(next).padStart(4, '0')}`;
}

// e.g. PRN-10512
export async function nextPrn() {
  const rows = await query('SELECT prn FROM profiles WHERE prn IS NOT NULL');
  return `PRN-${Math.max(10500, highestNumber(rows, 'prn') + 1)}`;
}

export const makeReferral = (fullName) => {
  const first = (fullName || 'GHOTOK').trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${first || 'GHOTOK'}-${rand}`;
};
