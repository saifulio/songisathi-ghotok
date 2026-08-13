// Reading the account behind a request: the user row and its role-specific
// rows, and the single profile a guardian / candidate has standing over.

import { query, queryOne } from '../../db/pool.js';
import { EMAIL_TOKEN_TTL_MS } from '../config.js';
import { makeToken } from './tokens.js';
import { capFirst } from './format.js';
import { sendVerificationEmail } from '../mailer.js';

export const publicUser = (user, extra = {}) => ({
  id: user.id,
  role: user.role,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email ?? null,
  emailVerified: Boolean(user.emailVerifiedAt),
  ...extra,
});

// Look a user up by phone (with role-specific rows), mirroring the old
// Prisma `include: { ghotok, guardian, candidate }`.
export async function findUserWithRelations(where, value) {
  const user = await queryOne(`SELECT * FROM users WHERE ${where} = ? LIMIT 1`, [value]);
  if (!user) return null;
  user.ghotok = await queryOne('SELECT * FROM ghotoks WHERE userId = ? LIMIT 1', [user.id]);
  user.guardian = await queryOne('SELECT * FROM guardians WHERE userId = ? LIMIT 1', [user.id]);
  user.candidate = await queryOne('SELECT * FROM profiles WHERE candidateUserId = ? LIMIT 1', [user.id]);
  return user;
}

// The role-specific extras /auth/signin and /auth/me hang off publicUser.
// `signin` also reports the referral code; `me` never has.
export const relationExtras = (user, { withReferral = false } = {}) => {
  const extra = {};
  if (user.ghotok) {
    extra.code = user.ghotok.code;
    extra.tier = user.ghotok.tier;
    if (withReferral) extra.referralCode = user.ghotok.referralCode;
  }
  if (user.guardian) extra.relation = user.guardian.relation;
  if (user.candidate) {
    extra.profileId = user.candidate.id;
    extra.gender = user.candidate.gender;
    extra.selfManaged = user.candidate.managerType === 'SELF';
  }
  return extra;
};

// Issue + email an email-verification token for a user (best-effort; a mail
// failure never blocks the surrounding request).
export async function issueVerificationEmail(user) {
  if (!user.email) return;
  const { raw, hash } = makeToken();
  await query(
    'INSERT INTO email_verification_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)',
    [user.id, hash, new Date(Date.now() + EMAIL_TOKEN_TTL_MS)]
  );
  try {
    await sendVerificationEmail({ to: user.email, fullName: user.fullName, token: raw });
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
  }
}

// The single profile this account has standing over: the one a guardian
// manages, or the candidate's own biodata. selfManaged mirrors
// profiles.managerType === 'SELF' — a self-signed-up bride/groom decides for
// themselves; a candidate whose profile a ghotok or guardian manages does not.
export async function myProfileForReq(req) {
  if (req.auth.role === 'GUARDIAN') {
    const guardian = await queryOne('SELECT * FROM guardians WHERE userId = ? LIMIT 1', [req.auth.sub]);
    if (!guardian) return null;
    const profile = await queryOne('SELECT * FROM profiles WHERE managedByGuardianId = ? LIMIT 1', [guardian.id]);
    if (!profile) return null;
    return { profile, selfManaged: false };
  }
  if (req.auth.role === 'CANDIDATE') {
    const profile = await queryOne('SELECT * FROM profiles WHERE candidateUserId = ? LIMIT 1', [req.auth.sub]);
    if (!profile) return null;
    return { profile, selfManaged: profile.managerType === 'SELF' };
  }
  return null;
}

// Names whoever holds the decisions for a managed candidate, so the refusals
// in routes/me.js don't tell a ghotok-managed candidate to ask their guardian.
// Already capitalised: each use starts a sentence.
export const managerSubject = (profile) =>
  capFirst(profile.managerType === 'GHOTOK' ? 'your matchmaker' : 'your guardian');
