// Sign up / sign in for matchmaker (ghotok), guardian, and bride/groom (self),
// plus email verification and password reset.

import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { RESET_TOKEN_TTL_MS, TIER_LIMIT } from '../config.js';
import { bad } from '../lib/http.js';
import { signToken, makeToken, hashToken } from '../lib/tokens.js';
import {
  publicUser, relationExtras, findUserWithRelations, issueVerificationEmail,
} from '../lib/accounts.js';
import { nextGhotokCode, makeReferral } from '../lib/refs.js';
import { requireAuth } from '../middleware.js';
import { sendPasswordResetEmail } from '../mailer.js';

const router = express.Router();

const ACCOUNT_ROLE = {
  matchmaker: 'GHOTOK', guardian: 'GUARDIAN', bride: 'CANDIDATE', groom: 'CANDIDATE',
};

const INSERT_USER = 'INSERT INTO users (role, fullName, phone, email, passwordHash) VALUES (?, ?, ?, ?, ?)';

// ── sign up ──
// body: { accountType: 'matchmaker'|'guardian'|'bride'|'groom', fullName, phone, password, ...roleFields }
router.post('/auth/signup', async (req, res) => {
  const b = req.body || {};
  const accountType = String(b.accountType || '').toLowerCase();
  const fullName = (b.fullName || '').trim();
  const phone = (b.phone || '').trim();
  const password = b.password || '';
  const email = (b.email || '').trim().toLowerCase() || null;

  if (!fullName) return bad(res, 'Full name is required.');
  if (!phone) return bad(res, 'Phone number is required.');
  if (!password || password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  const role = ACCOUNT_ROLE[accountType];
  if (!role) return bad(res, 'Choose an account type.');

  const existing = await queryOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
  if (existing) return bad(res, 'That phone number is already registered. Try signing in instead.', 409);
  if (email) {
    const e = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (e) return bad(res, 'That email is already registered.', 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userRow = [role, fullName, phone, email, passwordHash];

  // Re-read the user (for its defaults) and email a verification link before
  // handing back a session — the same tail for all three account types.
  const finish = async (userId, extra) => {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    await issueVerificationEmail(user);
    return res.status(201).json({ token: signToken(user), user: publicUser(user, extra) });
  };

  // MATCHMAKER (ghotok)
  if (accountType === 'matchmaker') {
    if (!b.district) return bad(res, 'District is required for a matchmaker account.');
    const tier = ['SOLO', 'BUREAU', 'AGENCY'].includes(b.tier) ? b.tier : 'SOLO';
    const code = await nextGhotokCode();
    const referralCode = makeReferral(fullName);
    const { userId } = await withTransaction(async (tx) => {
      const id = await insert(tx, INSERT_USER, userRow);
      await insert(
        tx,
        `INSERT INTO ghotoks (userId, code, bureauName, district, tier, activeProfileLimit, referralCode, memberSince)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, code, b.bureauName || null, b.district, tier, TIER_LIMIT[tier], referralCode, new Date().getFullYear()]
      );
      return { userId: id };
    });
    return finish(userId, { code, tier, referralCode });
  }

  // GUARDIAN
  if (accountType === 'guardian') {
    const relation = b.relation || null;
    const { userId } = await withTransaction(async (tx) => {
      const id = await insert(tx, INSERT_USER, userRow);
      await insert(
        tx,
        'INSERT INTO guardians (userId, relation, district, selfManaged) VALUES (?, ?, ?, ?)',
        [id, relation, b.district || null, true]
      );
      return { userId: id };
    });
    return finish(userId, { relation });
  }

  // BRIDE / GROOM (self-managed candidate) — collect biodata
  for (const f of ['dob', 'heightLabel', 'district', 'degree', 'profession']) {
    if (!b[f]) return bad(res, `Missing required field: ${f}.`);
  }
  const gender = accountType === 'bride' ? 'FEMALE' : 'MALE';
  const dob = new Date(b.dob);
  if (Number.isNaN(dob.getTime())) return bad(res, 'Date of birth is invalid.');
  const familyType = ['NUCLEAR', 'JOINT'].includes(b.familyType) ? b.familyType : null;

  const { userId, profileId } = await withTransaction(async (tx) => {
    const id = await insert(tx, INSERT_USER, userRow);
    const newProfileId = await insert(
      tx,
      `INSERT INTO profiles
        (fullName, gender, dob, heightLabel, maritalStatus, district, area, degree, institution,
         profession, familyType, religion, religiousPractice, managerType, candidateUserId,
         status, photoLocked, completeness)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SELF', ?, 'DRAFT', ?, 60)`,
      [
        fullName, gender, dob, b.heightLabel, b.maritalStatus || 'Never married', b.district,
        b.area || null, b.degree, b.institution || null, b.profession, familyType,
        b.religion || null, b.religiousPractice || null, id, true,
      ]
    );
    return { userId: id, profileId: newProfileId };
  });
  return finish(userId, { profileId, gender, accountType, selfManaged: true });
});

// ── sign in ──
// body: { phone, password }
router.post('/auth/signin', async (req, res) => {
  const phone = (req.body?.phone || '').trim();
  const password = req.body?.password || '';
  if (!phone || !password) return bad(res, 'Phone and password are required.');

  const user = await findUserWithRelations('phone', phone);
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return bad(res, 'Incorrect phone number or password.', 401);
  if (!user.isActive) return bad(res, 'This account is inactive.', 403);

  const token = signToken(user);
  return res.json({ token, user: publicUser(user, relationExtras(user, { withReferral: true })) });
});

// ── current user (from token) ──
router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await findUserWithRelations('id', req.auth.sub);
  if (!user) return bad(res, 'User not found.', 404);
  return res.json({ user: publicUser(user, relationExtras(user)) });
});

// ── verify email ──
// body: { token }  — the raw token from the emailed link.
router.post('/auth/verify-email', async (req, res) => {
  const raw = (req.body?.token || '').trim();
  if (!raw) return bad(res, 'Verification token is required.');

  const record = await queryOne(
    'SELECT * FROM email_verification_tokens WHERE tokenHash = ? LIMIT 1',
    [hashToken(raw)]
  );
  if (!record || record.usedAt) return bad(res, 'This verification link is invalid or has already been used.');
  if (record.expiresAt < new Date()) return bad(res, 'This verification link has expired. Please request a new one.');

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE users SET emailVerifiedAt = ? WHERE id = ?', [new Date(), record.userId]);
    await tx.execute('UPDATE email_verification_tokens SET usedAt = ? WHERE id = ?', [new Date(), record.id]);
    // Invalidate any other outstanding verification tokens for this user.
    await tx.execute(
      'UPDATE email_verification_tokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [new Date(), record.userId]
    );
  });

  return res.json({ ok: true, message: 'Email verified. Thank you!' });
});

// ── resend verification ──
// body: { email }  — always replies the same way, to avoid leaking who is registered.
router.post('/auth/resend-verification', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) return bad(res, 'Email is required.');

  const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (user && !user.emailVerifiedAt) {
    // Retire older unused tokens before issuing a fresh one.
    await query(
      'UPDATE email_verification_tokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [new Date(), user.id]
    );
    await issueVerificationEmail(user);
  }

  return res.json({ ok: true, message: 'If that email needs verification, a new link is on its way.' });
});

// ── forgot password ──
// body: { email }  — always replies the same way, to avoid leaking who is registered.
router.post('/auth/forgot-password', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) return bad(res, 'Email is required.');

  const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (user) {
    // Invalidate previous reset tokens, then issue one fresh token.
    await query(
      'UPDATE password_reset_tokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [new Date(), user.id]
    );
    const { raw, hash } = makeToken();
    await query(
      'INSERT INTO password_reset_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)',
      [user.id, hash, new Date(Date.now() + RESET_TOKEN_TTL_MS)]
    );
    try {
      await sendPasswordResetEmail({ to: user.email, fullName: user.fullName, token: raw });
    } catch (err) {
      console.error('Failed to send password reset email:', err.message);
    }
  }

  return res.json({ ok: true, message: 'If that email is registered, a reset link is on its way.' });
});

// ── reset password ──
// body: { token, password }
router.post('/auth/reset-password', async (req, res) => {
  const raw = (req.body?.token || '').trim();
  const password = req.body?.password || '';
  if (!raw) return bad(res, 'Reset token is required.');
  if (!password || password.length < 6) return bad(res, 'Password must be at least 6 characters.');

  const record = await queryOne(
    'SELECT * FROM password_reset_tokens WHERE tokenHash = ? LIMIT 1',
    [hashToken(raw)]
  );
  if (!record || record.usedAt) return bad(res, 'This reset link is invalid or has already been used.');
  if (record.expiresAt < new Date()) return bad(res, 'This reset link has expired. Please request a new one.');

  const passwordHash = bcrypt.hashSync(password, 10);
  await withTransaction(async (tx) => {
    await tx.execute('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, record.userId]);
    await tx.execute('UPDATE password_reset_tokens SET usedAt = ? WHERE id = ?', [new Date(), record.id]);
    // Any other pending reset tokens for this user are now void.
    await tx.execute(
      'UPDATE password_reset_tokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [new Date(), record.userId]
    );
  });

  return res.json({ ok: true, message: 'Password updated. You can now sign in with your new password.' });
});

export default router;
