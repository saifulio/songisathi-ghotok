// Reading the account behind a request: the user row and its role-specific
// rows, and the single profile a guardian / candidate has standing over.

import { query, queryOne } from '../../db/pool.js';
import { EMAIL_TOKEN_TTL_MS } from '../config.js';
import { makeToken } from './tokens.js';
import { capFirst } from './format.js';
import { bad } from './http.js';
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

// How many profiles one guardian account may hold — a guardian matchmakes for
// their own family (a daughter, a nephew, a widowed sister), not for a book.
export const GUARDIAN_PROFILE_LIMIT = 5;

// Every profile this account has standing over: the ones a guardian manages
// (oldest first, up to GUARDIAN_PROFILE_LIMIT), or the candidate's own single
// biodata. The guardian row comes back with them — the callers that add or
// count profiles need it, and it is the same lookup.
export async function myProfilesForReq(req) {
  if (req.auth.role === 'GUARDIAN') {
    const guardian = await queryOne('SELECT * FROM guardians WHERE userId = ? LIMIT 1', [req.auth.sub]);
    if (!guardian) return { guardian: null, profiles: [] };
    const profiles = await query(
      'SELECT * FROM profiles WHERE managedByGuardianId = ? ORDER BY id',
      [guardian.id]
    );
    return { guardian, profiles };
  }
  if (req.auth.role === 'CANDIDATE') {
    const profile = await queryOne('SELECT * FROM profiles WHERE candidateUserId = ? LIMIT 1', [req.auth.sub]);
    return { guardian: null, profiles: profile ? [profile] : [] };
  }
  return { guardian: null, profiles: [] };
}

// One of those profiles, paired with the standing that comes with it.
// selfManaged mirrors profiles.managerType === 'SELF' — a self-signed-up
// bride/groom decides for themselves; a candidate whose profile a ghotok or
// guardian manages does not. A guardian always decides, so it is never their
// profile's own flag that matters here.
export const profileContext = (req, profile) => ({
  profile,
  selfManaged: req.auth.role === 'CANDIDATE' && profile.managerType === 'SELF',
});

// Names whoever holds the decisions for a managed candidate, so the refusals
// in routes/me.js don't tell a ghotok-managed candidate to ask their guardian.
// Already capitalised: each use starts a sentence.
export const managerSubject = (profile) =>
  capFirst(profile.managerType === 'GHOTOK' ? 'your matchmaker' : 'your guardian');

// Whether a member account may act on its profile, not merely read it: a
// guardian always decides for the profiles they manage, a candidate only when
// their own profile is self-managed.
export const hasStanding = (req, me) => req.auth.role !== 'CANDIDATE' || me.selfManaged;

// The profile a member route is acting for. Returns null once it has already
// replied, so callers just `if (!me) return;`. `refusal` completes the
// sentence "Your matchmaker …" / "Your guardian …". Lives here rather than in
// routes/me.js because sending an interest — which either a member or a ghotok
// may do — needs the same answer.
export function actingProfile(req, res, refusal) {
  const me = req.me;
  if (!me) {
    bad(res, 'No profile is linked to this account.', 403);
    return null;
  }
  if (!hasStanding(req, me)) {
    bad(res, `${managerSubject(me.profile)} ${refusal}`, 403);
    return null;
  }
  return me;
}
