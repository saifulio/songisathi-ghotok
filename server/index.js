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

// The ghotok row for the signed-in user (or null).
const ghotokForReq = (req) =>
  queryOne('SELECT * FROM ghotoks WHERE userId = ? LIMIT 1', [req.auth.sub]);

// ── view mappers ──
const STATUS_LABEL = {
  DRAFT: 'Draft', ACTIVE: 'Active', IN_DISCUSSION: 'In discussion',
  MATCH_IN_PROGRESS: 'Match in progress', MARRIED: 'Married',
  AUTO_ARCHIVED: 'Auto-archived', PAUSED: 'Paused',
};
const initialsOf = (name) =>
  String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const yearsSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) : null);
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);

// A DB profile row → the shape the ghotok's book / dashboard table expects.
function profileCard(p) {
  return {
    id: p.id,
    prn: p.prn,
    name: p.fullName,
    init: initialsOf(p.fullName),
    gender: p.gender,
    age: yearsSince(p.dob),
    height: p.heightLabel,
    edu: [p.degree, p.institution].filter(Boolean).join(', '),
    job: p.profession,
    city: p.area || p.district,
    region: p.district,
    status: STATUS_LABEL[p.status] || p.status,
    rawStatus: p.status,
    verified: Boolean(p.verified),
    locked: Boolean(p.photoLocked),
    pool: Boolean(p.inNetworkPool),
    days: daysSince(p.lastUpdatedAt),
    completeness: p.completeness,
  };
}

// A match-suggestion peer → a compact person summary for the suggestion card.
const suggestionPerson = (p) => ({
  init: initialsOf(p.fullName), name: p.fullName, age: yearsSince(p.dob),
  job: p.profession, city: p.area || p.district,
});

const capWord = (x) => (x ? x[0] + x.slice(1).toLowerCase() : x);
// Rough education level from the free-text degree (no dedicated column).
const eduLevelOf = (degree) =>
  /\b(m\.?a|m\.?sc|m\.?eng|mba|mbbs|mphil|ph\.?d|llm|masters|postgrad)/i.test(degree || '')
    ? 'Postgraduate' : 'Graduate';

// A DB profile row (joined with its manager) → the shape the search UI expects.
function searchProfile(r, myGhotokId, prefLabels) {
  const mine = r.managedByGhotokId === myGhotokId;
  let managedBy;
  let mgrMeta;
  if (r.managerType === 'GHOTOK') {
    managedBy = `${r.ghotokName || 'Ghotok'} (ghotok)`;
    mgrMeta = [r.ghotokCode, r.ghotokDistrict].filter(Boolean).join(' · ')
      + (mine ? ` · ${r.ghotokMarriages} marriages` : ' · pool member');
  } else if (r.managerType === 'GUARDIAN') {
    managedBy = `Guardian — ${r.guardianName || ''}`.trim();
    mgrMeta = [r.guardianRelation, 'self-managed family'].filter(Boolean).join(' · ');
  } else {
    managedBy = `${r.candidateName || r.fullName} (self)`;
    mgrMeta = 'Self-managed';
  }
  return {
    id: r.id,
    prn: r.prn,
    name: r.fullName,
    gender: r.gender,
    age: yearsSince(r.dob),
    height: r.heightLabel,
    edu: [r.degree, r.institution].filter(Boolean).join(', '),
    eduLevel: eduLevelOf(r.degree),
    job: r.profession,
    district: [r.area, r.district].filter(Boolean).join(', '),
    dcode: r.district,
    verified: Boolean(r.verified),
    screened: Number(r.sealedCount) > 0,
    mine,
    managedBy,
    mgrMeta,
    family: [capWord(r.familyType), r.fatherInfo].filter(Boolean).join(' · '),
    siblings: r.siblings || '—',
    religion: [r.religion, r.religiousPractice].filter(Boolean).join(' · ') || '—',
    looking: prefLabels.length ? prefLabels.join(', ') : '—',
  };
}

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

// ── the ghotok's book ──
// Every profile this ghotok manages, newest activity first.
app.get('/api/profiles', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const rows = await query(
    'SELECT * FROM profiles WHERE managedByGhotokId = ? ORDER BY lastUpdatedAt DESC',
    [ghotok.id]
  );
  return res.json({ profiles: rows.map(profileCard) });
});

// ── update a profile (dashboard actions) ──
// body: { inNetworkPool?: bool, attest?: bool }
//   inNetworkPool — toggle trusted-network visibility.
//   attest — the ghotok confirms the profile is still active: reset the
//            90-day archive clock, and un-archive it if it had lapsed.
app.patch('/api/profiles/:id', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const profile = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [req.params.id]);
  if (!profile) return bad(res, 'Profile not found.', 404);
  if (profile.managedByGhotokId !== ghotok.id) return bad(res, 'That profile is not in your book.', 403);

  const b = req.body || {};
  const sets = [];
  const params = [];
  if (typeof b.inNetworkPool === 'boolean') { sets.push('inNetworkPool = ?'); params.push(b.inNetworkPool ? 1 : 0); }
  if (b.attest === true) {
    sets.push('lastUpdatedAt = ?'); params.push(new Date());
    if (profile.status === 'AUTO_ARCHIVED') { sets.push("status = 'ACTIVE'"); }
  }
  if (!sets.length) return bad(res, 'Nothing to update.');
  await query(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`, [...params, profile.id]);

  const updated = await queryOne('SELECT * FROM profiles WHERE id = ?', [profile.id]);
  return res.json({ profile: profileCard(updated) });
});

// ── dashboard stats ──
app.get('/api/dashboard/stats', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);

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
      commissionReceived: Number(payments?.received || 0),
      paymentsReceived: Number(payments?.paid || 0),
      paymentsTotal: Number(payments?.total || 0),
      tier: ghotok.tier,
      code: ghotok.code,
      referralCode: ghotok.referralCode,
    },
  });
});

// ── search: the ghotok's book + the trusted-network pool ──
// Returns every profile this ghotok may see (their own, plus any pooled
// profile from another manager), as rich objects the search UI filters
// client-side. Drafts and auto-archived profiles are left out.
app.get('/api/profiles/search', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);

  const rows = await query(
    `SELECT p.*,
        gu.fullName AS ghotokName, g.code AS ghotokCode, g.district AS ghotokDistrict, g.marriagesClosed AS ghotokMarriages,
        gdu.fullName AS guardianName, gd.relation AS guardianRelation,
        cu.fullName AS candidateName,
        (SELECT COUNT(*) FROM screening_responses sr WHERE sr.profileId = p.id AND sr.sealed = 1) AS sealedCount
       FROM profiles p
       LEFT JOIN ghotoks g   ON p.managedByGhotokId = g.id
       LEFT JOIN users gu    ON g.userId = gu.id
       LEFT JOIN guardians gd ON p.managedByGuardianId = gd.id
       LEFT JOIN users gdu   ON gd.userId = gdu.id
       LEFT JOIN users cu    ON p.candidateUserId = cu.id
      WHERE (p.managedByGhotokId = ? OR p.inNetworkPool = 1)
        AND p.status NOT IN ('DRAFT', 'AUTO_ARCHIVED')
      ORDER BY p.lastUpdatedAt DESC`,
    [ghotok.id]
  );

  const ids = rows.map((r) => r.id);
  const prefsByProfile = {};
  if (ids.length) {
    const prefs = await query(
      `SELECT profileId, label FROM profile_preferences WHERE enabled = 1 AND profileId IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    for (const pr of prefs) (prefsByProfile[pr.profileId] ||= []).push(pr.label);
  }

  return res.json({ profiles: rows.map((r) => searchProfile(r, ghotok.id, prefsByProfile[r.id] || [])) });
});

// ── AI match suggestions (this ghotok's open suggestions) ──
app.get('/api/match-suggestions', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const sugs = await query(
    "SELECT * FROM match_suggestions WHERE ghotokId = ? AND status = 'OPEN' ORDER BY score DESC",
    [ghotok.id]
  );
  const out = [];
  for (const s of sugs) {
    const [a, b, factors] = await Promise.all([
      queryOne('SELECT fullName, dob, profession, area, district FROM profiles WHERE id = ?', [s.profileAId]),
      queryOne('SELECT fullName, dob, profession, area, district FROM profiles WHERE id = ?', [s.profileBId]),
      query('SELECT label, percentage, note FROM match_factors WHERE suggestionId = ? ORDER BY id', [s.id]),
    ]);
    out.push({
      id: s.id,
      score: s.score,
      screeningPassed: Boolean(s.screeningPassed),
      a: a ? suggestionPerson(a) : null,
      b: b ? suggestionPerson(b) : null,
      factors: factors.map((f) => ({ label: f.label, pct: f.percentage, note: f.note })),
    });
  }
  return res.json({ suggestions: out });
});

// ── act on a suggestion ──
// body: { status: 'ACCEPTED' | 'DISMISSED' }
// Accepting nudges both profiles into "in discussion".
app.patch('/api/match-suggestions/:id', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const status = req.body?.status;
  if (!['ACCEPTED', 'DISMISSED'].includes(status)) return bad(res, 'status must be ACCEPTED or DISMISSED.');
  const sug = await queryOne('SELECT * FROM match_suggestions WHERE id = ? LIMIT 1', [req.params.id]);
  if (!sug) return bad(res, 'Suggestion not found.', 404);
  if (sug.ghotokId !== ghotok.id) return bad(res, 'That suggestion is not yours.', 403);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE match_suggestions SET status = ? WHERE id = ?', [status, sug.id]);
    if (status === 'ACCEPTED') {
      await tx.execute(
        "UPDATE profiles SET status = 'IN_DISCUSSION' WHERE id IN (?, ?) AND status = 'ACTIVE'",
        [sug.profileAId, sug.profileBId]
      );
    }
  });
  return res.json({ ok: true, status });
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
