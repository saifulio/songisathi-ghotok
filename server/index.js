// SongiSathi Ghotok — auth API.
// Signup / signin for matchmaker (ghotok), guardian, and bride/groom (self).
// Run: npm run server   (needs the MySQL DB migrated: npm run db:migrate)
//
// Data access is plain MySQL via mysql2 (see db/pool.js) — no ORM.

import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne, withTransaction, insert } from '../db/pool.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './mailer.js';

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const PORT = process.env.API_PORT || 4000;

// Token lifetimes.
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; //  1 hour

// ── helpers ──
const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

const publicUser = (user, extra = {}) => ({
  id: user.id,
  role: user.role,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email ?? null,
  emailVerified: Boolean(user.emailVerifiedAt),
  ...extra,
});

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ── auth middleware ──
// requireAuth verifies the Bearer token and hangs { sub, role } on req.auth.
// requireRole(...roles) gates a route to specific roles (use after requireAuth).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return bad(res, 'Not authenticated.', 401);
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return bad(res, 'Invalid or expired token.', 401);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role) ? next() : bad(res, 'Not allowed for your role.', 403);

// A one-time token: a raw random string (returned, goes in the email link) and
// its SHA-256 hash (stored, so a DB leak never exposes a usable token).
const makeToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};
const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// Look a user up by phone (with role-specific rows), mirroring the old
// Prisma `include: { ghotok, guardian, candidate }`.
async function findUserWithRelations(where, value) {
  const user = await queryOne(`SELECT * FROM users WHERE ${where} = ? LIMIT 1`, [value]);
  if (!user) return null;
  user.ghotok = await queryOne('SELECT * FROM ghotoks WHERE userId = ? LIMIT 1', [user.id]);
  user.guardian = await queryOne('SELECT * FROM guardians WHERE userId = ? LIMIT 1', [user.id]);
  user.candidate = await queryOne('SELECT * FROM profiles WHERE candidateUserId = ? LIMIT 1', [user.id]);
  return user;
}

// Issue + email an email-verification token for a user (best-effort; a mail
// failure never blocks the surrounding request).
async function issueVerificationEmail(user) {
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

async function nextGhotokCode() {
  const rows = await query('SELECT code FROM ghotoks');
  const max = rows.reduce((m, r) => {
    const n = parseInt(String(r.code).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const next = Math.max(500, max + 1);
  return `GHT-${String(next).padStart(4, '0')}`;
}

// Next profile reference number, e.g. PRN-10512 — scans existing PRNs and
// increments the highest (with a floor so new installs start at a sensible number).
async function nextPrn() {
  const rows = await query('SELECT prn FROM profiles WHERE prn IS NOT NULL');
  const max = rows.reduce((m, r) => {
    const n = parseInt(String(r.prn).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `PRN-${Math.max(10500, max + 1)}`;
}

const makeReferral = (fullName) => {
  const first = (fullName || 'GHOTOK').trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${first || 'GHOTOK'}-${rand}`;
};

// ── health ──
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── sign up ──
// body: { accountType: 'matchmaker'|'guardian'|'bride'|'groom', fullName, phone, password, ...roleFields }
app.post('/api/auth/signup', async (req, res) => {
  const b = req.body || {};
  const accountType = String(b.accountType || '').toLowerCase();
  const fullName = (b.fullName || '').trim();
  const phone = (b.phone || '').trim();
  const password = b.password || '';
  const email = (b.email || '').trim().toLowerCase() || null;

  if (!fullName) return bad(res, 'Full name is required.');
  if (!phone) return bad(res, 'Phone number is required.');
  if (!password || password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  if (!['matchmaker', 'guardian', 'bride', 'groom'].includes(accountType))
    return bad(res, 'Choose an account type.');

  const existing = await queryOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
  if (existing) return bad(res, 'That phone number is already registered. Try signing in instead.', 409);
  if (email) {
    const e = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (e) return bad(res, 'That email is already registered.', 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const role =
    accountType === 'matchmaker' ? 'GHOTOK' : accountType === 'guardian' ? 'GUARDIAN' : 'CANDIDATE';

  // MATCHMAKER (ghotok)
  if (accountType === 'matchmaker') {
    if (!b.district) return bad(res, 'District is required for a matchmaker account.');
    const tier = ['SOLO', 'BUREAU', 'AGENCY'].includes(b.tier) ? b.tier : 'SOLO';
    const limit = tier === 'AGENCY' ? 150 : tier === 'BUREAU' ? 50 : 20;
    const code = await nextGhotokCode();
    const referralCode = makeReferral(fullName);
    const result = await withTransaction(async (tx) => {
      const userId = await insert(
        tx,
        'INSERT INTO users (role, fullName, phone, email, passwordHash) VALUES (?, ?, ?, ?, ?)',
        [role, fullName, phone, email, passwordHash]
      );
      await insert(
        tx,
        `INSERT INTO ghotoks (userId, code, bureauName, district, tier, activeProfileLimit, referralCode, memberSince)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, code, b.bureauName || null, b.district, tier, limit, referralCode, new Date().getFullYear()]
      );
      return { userId };
    });
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [result.userId]);
    await issueVerificationEmail(user);
    const token = signToken(user);
    return res.status(201).json({
      token,
      user: publicUser(user, { code, tier, referralCode }),
    });
  }

  // GUARDIAN
  if (accountType === 'guardian') {
    const relation = b.relation || null;
    const result = await withTransaction(async (tx) => {
      const userId = await insert(
        tx,
        'INSERT INTO users (role, fullName, phone, email, passwordHash) VALUES (?, ?, ?, ?, ?)',
        [role, fullName, phone, email, passwordHash]
      );
      await insert(
        tx,
        'INSERT INTO guardians (userId, relation, district, selfManaged) VALUES (?, ?, ?, ?)',
        [userId, relation, b.district || null, true]
      );
      return { userId };
    });
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [result.userId]);
    await issueVerificationEmail(user);
    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user, { relation }) });
  }

  // BRIDE / GROOM (self-managed candidate) — collect biodata
  const required = ['dob', 'heightLabel', 'district', 'degree', 'profession'];
  for (const f of required) {
    if (!b[f]) return bad(res, `Missing required field: ${f}.`);
  }
  const gender = accountType === 'bride' ? 'FEMALE' : 'MALE';
  const dob = new Date(b.dob);
  if (Number.isNaN(dob.getTime())) return bad(res, 'Date of birth is invalid.');
  const familyType = ['NUCLEAR', 'JOINT'].includes(b.familyType) ? b.familyType : null;

  const result = await withTransaction(async (tx) => {
    const userId = await insert(
      tx,
      'INSERT INTO users (role, fullName, phone, email, passwordHash) VALUES (?, ?, ?, ?, ?)',
      [role, fullName, phone, email, passwordHash]
    );
    const profileId = await insert(
      tx,
      `INSERT INTO profiles
        (fullName, gender, dob, heightLabel, maritalStatus, district, area, degree, institution,
         profession, familyType, religion, religiousPractice, managerType, candidateUserId,
         status, photoLocked, completeness)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SELF', ?, 'DRAFT', ?, 60)`,
      [
        fullName, gender, dob, b.heightLabel, b.maritalStatus || 'Never married', b.district,
        b.area || null, b.degree, b.institution || null, b.profession, familyType,
        b.religion || null, b.religiousPractice || null, userId, true,
      ]
    );
    return { userId, profileId };
  });
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [result.userId]);
  await issueVerificationEmail(user);
  const token = signToken(user);
  return res.status(201).json({
    token,
    user: publicUser(user, { profileId: result.profileId, gender, accountType }),
  });
});

// ── sign in ──
// body: { phone, password }
app.post('/api/auth/signin', async (req, res) => {
  const phone = (req.body?.phone || '').trim();
  const password = req.body?.password || '';
  if (!phone || !password) return bad(res, 'Phone and password are required.');

  const user = await findUserWithRelations('phone', phone);
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return bad(res, 'Incorrect phone number or password.', 401);
  if (!user.isActive) return bad(res, 'This account is inactive.', 403);

  const extra = {};
  if (user.ghotok) { extra.code = user.ghotok.code; extra.tier = user.ghotok.tier; extra.referralCode = user.ghotok.referralCode; }
  if (user.guardian) { extra.relation = user.guardian.relation; }
  if (user.candidate) { extra.profileId = user.candidate.id; extra.gender = user.candidate.gender; }

  const token = signToken(user);
  return res.json({ token, user: publicUser(user, extra) });
});

// ── current user (from token) ──
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await findUserWithRelations('id', req.auth.sub);
  if (!user) return bad(res, 'User not found.', 404);
  const extra = {};
  if (user.ghotok) { extra.code = user.ghotok.code; extra.tier = user.ghotok.tier; }
  if (user.guardian) { extra.relation = user.guardian.relation; }
  if (user.candidate) { extra.profileId = user.candidate.id; extra.gender = user.candidate.gender; }
  return res.json({ user: publicUser(user, extra) });
});

// ── screening questions (the sealed layer) ──
// The private questions shown in the Add-profile wizard, from the DB.
app.get('/api/screening-questions', requireAuth, async (_req, res) => {
  const qs = await query(
    'SELECT id, code, questionBn, questionEn, helpText, type FROM screening_questions ORDER BY sortOrder'
  );
  const optionRows = await query(
    'SELECT questionId, label FROM screening_options ORDER BY sortOrder'
  );
  const optionsByQ = {};
  for (const o of optionRows) (optionsByQ[o.questionId] ||= []).push(o.label);
  res.json({
    questions: qs.map((q) => ({
      id: q.code,
      bn: q.questionBn,
      en: q.questionEn,
      help: q.helpText || '',
      type: q.type === 'TEXT' ? 'text' : 'choice',
      options: optionsByQ[q.id] || [],
    })),
  });
});

// ── create a profile ──
// A ghotok adds a candidate to their book. Creates the biodata, the "looking
// for" preferences, and any sealed screening answers, in one transaction.
// body: { fullName, gender, dob, heightLabel, maritalStatus, district, area,
//         degree, institution, profession, familyType, religion, religiousPractice,
//         preferences:[{label,enabled}], screening:{ q1:.., q6:.. }, owner,
//         sealed, inNetworkPool, publish }
app.post('/api/profiles', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const b = req.body || {};
  const ghotok = await queryOne('SELECT id FROM ghotoks WHERE userId = ? LIMIT 1', [req.auth.sub]);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);

  const fullName = (b.fullName || '').trim();
  if (!fullName) return bad(res, 'Full name is required.');
  const gender = ['MALE', 'FEMALE'].includes(b.gender) ? b.gender : null;
  if (!gender) return bad(res, 'Gender is required.');
  if (!b.district) return bad(res, 'District is required.');

  let dob = null;
  if (b.dob) {
    dob = new Date(b.dob);
    if (Number.isNaN(dob.getTime())) return bad(res, 'Date of birth is invalid.');
  }
  const familyType = ['NUCLEAR', 'JOINT'].includes(String(b.familyType || '').toUpperCase())
    ? String(b.familyType).toUpperCase()
    : null;

  const publish = Boolean(b.publish);
  const sealed = Boolean(b.sealed);
  const inNetworkPool = Boolean(b.inNetworkPool);
  const owner = { guardian: 'GUARDIAN', candidate: 'CANDIDATE', ghotok: 'GHOTOK' }[b.owner] || 'GHOTOK';
  const screening = b.screening && typeof b.screening === 'object' ? b.screening : {};

  // Completeness: a filled biodata is ~60%, screening answers make up the rest.
  const questionRows = await query('SELECT id, code FROM screening_questions');
  const totalQ = questionRows.length || 1;
  const answeredQ = questionRows.filter((q) => String(screening[q.code] ?? '').trim() !== '').length;
  const completeness = Math.min(100, 60 + Math.round((answeredQ / totalQ) * 40));

  const prn = publish ? await nextPrn() : null;
  const status = publish ? 'ACTIVE' : 'DRAFT';

  const { profileId } = await withTransaction(async (tx) => {
    const id = await insert(
      tx,
      `INSERT INTO profiles
        (prn, fullName, gender, dob, heightLabel, maritalStatus, district, area, degree, institution,
         profession, familyType, religion, religiousPractice, managerType, managedByGhotokId,
         status, photoLocked, inNetworkPool, completeness)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GHOTOK', ?, ?, ?, ?, ?)`,
      [
        prn, fullName, gender, dob, b.heightLabel || null, b.maritalStatus || 'Never married',
        b.district, b.area || null, b.degree || null, b.institution || null, b.profession || null,
        familyType, b.religion || null, b.religiousPractice || null, ghotok.id,
        status, true, inNetworkPool, completeness,
      ]
    );

    if (Array.isArray(b.preferences)) {
      for (const p of b.preferences) {
        if (p && p.label) {
          await insert(tx, 'INSERT INTO profile_preferences (profileId, label, enabled) VALUES (?, ?, ?)', [id, String(p.label), p.enabled ? 1 : 0]);
        }
      }
    }

    const sealedAt = sealed ? new Date() : null;
    for (const q of questionRows) {
      const val = screening[q.code];
      if (val == null || String(val).trim() === '') continue;
      await insert(
        tx,
        'INSERT INTO screening_responses (profileId, questionId, answerValue, sealed, sealedAt, answeredByRole) VALUES (?, ?, ?, ?, ?, ?)',
        [id, q.id, String(val), sealed ? 1 : 0, sealedAt, owner]
      );
    }
    return { profileId: id };
  });

  const profile = await queryOne('SELECT * FROM profiles WHERE id = ?', [profileId]);
  return res.status(201).json({ profile });
});

// ── verify email ──
// body: { token }  — the raw token from the emailed link.
app.post('/api/auth/verify-email', async (req, res) => {
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
app.post('/api/auth/resend-verification', async (req, res) => {
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
app.post('/api/auth/forgot-password', async (req, res) => {
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
app.post('/api/auth/reset-password', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`SongiSathi API running at http://localhost:${PORT}`);
});
