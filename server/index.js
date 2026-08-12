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
  edu: [p.degree, p.institution].filter(Boolean).join(', '),
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

// Coarse "2 hours ago" / "Yesterday" / "Last week" phrasing for interest timestamps.
function relativeTime(d) {
  if (!d) return '';
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  if (day < 14) return 'Last week';
  return `${Math.floor(day / 7)} weeks ago`;
}

// The joined columns interestItem() expects — shared by the list and the
// single-row refetch after a PATCH.
const INTEREST_SELECT = `
  SELECT i.id, i.kind, i.status, i.message, i.compatibilityScore, i.screeningResult, i.declineReason, i.createdAt,
         i.fromGhotokId, i.fromGuardianId, i.fromLabel, i.theirProfileId, i.yourProfileId,
         tp.prn AS theirPrn, tp.fullName AS theirName, tp.dob AS theirDob, tp.degree AS theirDegree,
         tp.institution AS theirInstitution, tp.area AS theirArea, tp.district AS theirDistrict,
         tp.familyType AS theirFamilyType, tp.fatherInfo AS theirFatherInfo, tp.siblings AS theirSiblings,
         tp.religiousPractice AS theirReligiousPractice,
         yp.prn AS yourPrn, yp.fullName AS yourName, yp.dob AS yourDob, yp.degree AS yourDegree,
         yp.institution AS yourInstitution, yp.area AS yourArea, yp.district AS yourDistrict,
         fg.code AS fromGhotokCode, fg.district AS fromGhotokDistrict, fg.marriagesClosed AS fromGhotokMarriages,
         fg.memberSince AS fromGhotokMemberSince, fgu.fullName AS fromGhotokName,
         (SELECT COUNT(*) FROM profiles WHERE managedByGhotokId = fg.id) AS fromGhotokProfileCount,
         fgd.relation AS fromGuardianRelation, fgd.createdAt AS fromGuardianCreatedAt, fgdu.fullName AS fromGuardianName,
         (SELECT COUNT(*) FROM profiles WHERE managedByGuardianId = fgd.id) AS fromGuardianProfileCount
    FROM interests i
    JOIN profiles tp ON i.theirProfileId = tp.id
    JOIN profiles yp ON i.yourProfileId = yp.id
    LEFT JOIN ghotoks fg ON i.fromGhotokId = fg.id
    LEFT JOIN users fgu ON fg.userId = fgu.id
    LEFT JOIN guardians fgd ON i.fromGuardianId = fgd.id
    LEFT JOIN users fgdu ON fgd.userId = fgdu.id
`;

// A joined interest row → the shape the inbox UI expects.
function interestItem(r) {
  const kind = { INTEREST: 'interest', PHOTO_REQUEST: 'photo', CONTACT_RELEASE: 'release' }[r.kind] || 'interest';
  const isGhotok = r.fromGhotokId != null;
  const isGuardian = !isGhotok && r.fromGuardianId != null;
  const fromName = isGhotok ? (r.fromGhotokName || 'Ghotok')
    : isGuardian ? `Guardian — ${r.fromGuardianName || ''}`.trim()
      : r.fromLabel;
  const fromMeta = isGhotok
    ? [r.fromGhotokCode, r.fromGhotokDistrict].filter(Boolean).join(' · ')
    : isGuardian
      ? [r.fromGuardianRelation, 'self-managed family'].filter(Boolean).join(' · ')
      : '';
  const mgrStats = isGhotok
    ? [
        { k: 'Marriages closed', v: String(r.fromGhotokMarriages ?? 0) },
        { k: 'Profiles managed', v: String(r.fromGhotokProfileCount ?? 0) },
        { k: 'Member since', v: String(r.fromGhotokMemberSince ?? '—') },
      ]
    : isGuardian
      ? [
          { k: 'Profiles managed', v: String(r.fromGuardianProfileCount ?? 0) },
          { k: 'Relation', v: r.fromGuardianRelation || '—' },
          { k: 'Member since', v: r.fromGuardianCreatedAt ? String(new Date(r.fromGuardianCreatedAt).getFullYear()) : '—' },
        ]
      : [];

  const theirEdu = [r.theirDegree, r.theirInstitution].filter(Boolean).join(', ');
  const yourEdu = [r.yourDegree, r.yourInstitution].filter(Boolean).join(', ');
  const theirLoc = [r.theirArea, r.theirDistrict].filter(Boolean).join(', ');
  const yourLoc = [r.yourArea, r.yourDistrict].filter(Boolean).join(', ');

  const summary = kind === 'photo'
    ? `Photo access request for ${r.yourName}, for one specific proposal.`
    : kind === 'release'
      ? `Contact release for ${r.yourName} ↔ ${r.theirName}.`
      : `Interest in ${r.yourName} on behalf of ${r.theirName}’s family.`;

  return {
    id: r.id,
    kind,
    status: String(r.status).toLowerCase(),
    init: initialsOf(fromName),
    fromName,
    fromMeta,
    when: relativeTime(r.createdAt),
    score: r.compatibilityScore,
    theirProfileId: r.theirProfileId,
    theirName: r.theirName, theirPrn: r.theirPrn, theirMeta: `${yearsSince(r.theirDob) ?? '—'} · ${theirEdu} · ${theirLoc}`,
    theirFacts: [
      { k: 'Family', v: [capWord(r.theirFamilyType), r.theirFatherInfo].filter(Boolean).join(', ') || '—' },
      { k: 'Siblings', v: r.theirSiblings || '—' },
      { k: 'Practice', v: r.theirReligiousPractice || '—' },
    ],
    yourProfileId: r.yourProfileId,
    yourName: r.yourName, yourPrn: r.yourPrn, yourMeta: `${yearsSince(r.yourDob) ?? '—'} · ${yourEdu} · ${yourLoc}`,
    summary,
    message: r.message || '',
    declineReason: r.declineReason || null,
    screeningResult: r.screeningResult || 'Compatible',
    mgrStats,
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
    user: publicUser(user, { profileId: result.profileId, gender, accountType, selfManaged: true }),
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
  if (user.candidate) { extra.profileId = user.candidate.id; extra.gender = user.candidate.gender; extra.selfManaged = user.candidate.managerType === 'SELF'; }

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
  if (user.candidate) { extra.profileId = user.candidate.id; extra.gender = user.candidate.gender; extra.selfManaged = user.candidate.managerType === 'SELF'; }
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

// ── full detail for one profile (biodata studio) ──
app.get('/api/profiles/:id', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const p = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [req.params.id]);
  if (!p) return bad(res, 'Profile not found.', 404);
  if (p.managedByGhotokId !== ghotok.id) return bad(res, 'That profile is not in your book.', 403);

  const prefs = await query('SELECT label FROM profile_preferences WHERE profileId = ? AND enabled = 1 ORDER BY id', [p.id]);
  const managerUser = await queryOne('SELECT fullName FROM users WHERE id = ?', [ghotok.userId]);

  return res.json({
    profile: {
      id: p.id,
      prn: p.prn,
      name: p.fullName,
      age: yearsSince(p.dob),
      heightLabel: p.heightLabel,
      district: p.district,
      area: p.area,
      degree: p.degree,
      institution: p.institution,
      undergraduate: p.undergraduate,
      profession: p.profession,
      organisation: p.organisation,
      familyType: p.familyType,
      fatherInfo: p.fatherInfo,
      motherInfo: p.motherInfo,
      siblings: p.siblings,
      familyIncome: p.familyIncome,
      religion: p.religion,
      religiousPractice: p.religiousPractice,
      photoLocked: Boolean(p.photoLocked),
      looking: prefs.map((r) => r.label),
    },
    manager: { name: managerUser?.fullName || '', code: ghotok.code, district: ghotok.district },
  });
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
      queryOne('SELECT fullName, dob, profession, area, district, degree, institution FROM profiles WHERE id = ?', [s.profileAId]),
      queryOne('SELECT fullName, dob, profession, area, district, degree, institution FROM profiles WHERE id = ?', [s.profileBId]),
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

// ── interest inbox (requests on this ghotok's profiles) ──
app.get('/api/interests', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const rows = await query(`${INTEREST_SELECT} WHERE yp.managedByGhotokId = ? ORDER BY i.createdAt DESC`, [ghotok.id]);
  return res.json({ interests: rows.map(interestItem) });
});

// ── decide on an interest ──
// body: { status: 'ACCEPTED' | 'DECLINED' | 'EXPIRED', declineReason? }
//   ACCEPTED — nudges both candidates into "in discussion" (interest requests only).
//   DECLINED — requires declineReason; the other manager only sees the reason, never your candidate's name.
//   EXPIRED  — "hold for a week"; the other manager sees "under consideration".
app.patch('/api/interests/:id', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const status = req.body?.status;
  if (!['ACCEPTED', 'DECLINED', 'EXPIRED'].includes(status)) return bad(res, 'status must be ACCEPTED, DECLINED, or EXPIRED.');
  const declineReason = status === 'DECLINED' ? String(req.body?.declineReason || '').trim() : null;
  if (status === 'DECLINED' && !declineReason) return bad(res, 'A decline reason is required.');

  const owned = await queryOne(
    `SELECT i.id, i.kind, i.theirProfileId, i.yourProfileId
       FROM interests i JOIN profiles yp ON i.yourProfileId = yp.id
      WHERE i.id = ? AND yp.managedByGhotokId = ? LIMIT 1`,
    [req.params.id, ghotok.id]
  );
  if (!owned) return bad(res, 'Request not found.', 404);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE interests SET status = ?, declineReason = ? WHERE id = ?', [status, declineReason, owned.id]);
    if (status === 'ACCEPTED' && owned.kind === 'INTEREST') {
      await tx.execute(
        "UPDATE profiles SET status = 'IN_DISCUSSION' WHERE id IN (?, ?) AND status = 'ACTIVE'",
        [owned.theirProfileId, owned.yourProfileId]
      );
    }
  });

  const [row] = await query(`${INTEREST_SELECT} WHERE i.id = ?`, [owned.id]);
  return res.json({ interest: interestItem(row) });
});

// ── commission ledger ──
app.get('/api/marriages', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const rows = await query('SELECT * FROM marriages WHERE ghotokId = ? ORDER BY weddingDate DESC', [ghotok.id]);
  return res.json({
    marriages: rows.map((m) => ({
      id: m.id, pair: m.pairLabel, prns: m.prns, date: m.weddingDate,
      agreed: m.agreedAmount, received: m.receivedAmount, status: m.status,
    })),
  });
});

// ── pairs this ghotok could record as married ──
// Sourced from the two places a pair becomes "in progress": an AI-matching
// suggestion this ghotok accepted, or an inbound interest accepted on one of
// their own profiles. Already-married pairs are excluded.
app.get('/api/marriages/closable-pairs', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);

  const [fromSuggestions, fromInterests] = await Promise.all([
    query(
      "SELECT id AS srcId, 'suggestion' AS src, profileAId, profileBId, createdAt FROM match_suggestions WHERE ghotokId = ? AND status = 'ACCEPTED'",
      [ghotok.id]
    ),
    query(
      `SELECT i.id AS srcId, 'interest' AS src, i.theirProfileId AS profileAId, i.yourProfileId AS profileBId, i.createdAt
         FROM interests i JOIN profiles yp ON i.yourProfileId = yp.id
        WHERE yp.managedByGhotokId = ? AND i.status = 'ACCEPTED' AND i.kind = 'INTEREST'`,
      [ghotok.id]
    ),
  ]);

  const seen = new Map();
  for (const row of [...fromSuggestions, ...fromInterests]) {
    const key = [row.profileAId, row.profileBId].sort((x, y) => x - y).join('-');
    if (!seen.has(key)) seen.set(key, row);
  }
  const candidates = [...seen.values()];
  if (!candidates.length) return res.json({ pairs: [] });

  const profileIds = [...new Set(candidates.flatMap((c) => [c.profileAId, c.profileBId]))];
  const profiles = await query(
    `SELECT id, fullName, prn, status FROM profiles WHERE id IN (${profileIds.map(() => '?').join(',')})`,
    profileIds
  );
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const STATE_LABEL = { MATCH_IN_PROGRESS: 'Match in progress', IN_DISCUSSION: 'In discussion' };

  const pairs = candidates
    .map((c) => {
      const a = byId[c.profileAId];
      const b = byId[c.profileBId];
      if (!a || !b || a.status === 'MARRIED' || b.status === 'MARRIED') return null;
      return {
        id: `${c.src}-${c.srcId}`,
        profileAId: a.id, profileBId: b.id,
        pair: `${a.fullName} ↔ ${b.fullName}`,
        prns: `${a.prn || '—'} · ${b.prn || '—'}`,
        since: c.createdAt,
        state: STATE_LABEL[a.status] || STATE_LABEL[b.status] || 'Introduced',
      };
    })
    .filter(Boolean);

  return res.json({ pairs });
});

// ── record a marriage ──
// Closes both profiles out of matching, logs the commission, and adds one to
// the ghotok's lifetime count.
// body: { profileAId, profileBId, brideFee, groomFee, weddingDate, paidFull }
app.post('/api/marriages', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);

  const b = req.body || {};
  const profileAId = Number(b.profileAId);
  const profileBId = Number(b.profileBId);
  if (!profileAId || !profileBId) return bad(res, 'Choose which pair you are closing.');
  const brideFee = Math.max(0, Number(b.brideFee) || 0);
  const groomFee = Math.max(0, Number(b.groomFee) || 0);
  const weddingDate = new Date(b.weddingDate);
  if (Number.isNaN(weddingDate.getTime())) return bad(res, 'Wedding date is invalid.');

  const [profileA, profileB] = await Promise.all([
    queryOne('SELECT id, fullName, prn, managedByGhotokId FROM profiles WHERE id = ?', [profileAId]),
    queryOne('SELECT id, fullName, prn, managedByGhotokId FROM profiles WHERE id = ?', [profileBId]),
  ]);
  if (!profileA || !profileB) return bad(res, 'Profile not found.', 404);
  if (profileA.managedByGhotokId !== ghotok.id && profileB.managedByGhotokId !== ghotok.id)
    return bad(res, 'At least one profile must be in your book.', 403);

  const agreedAmount = brideFee + groomFee;
  const receivedAmount = b.paidFull ? agreedAmount : 0;
  const status = receivedAmount >= agreedAmount && agreedAmount > 0 ? 'PAID' : receivedAmount > 0 ? 'PART_PAID' : 'UNPAID';
  const pairLabel = `${profileA.fullName} ↔ ${profileB.fullName}`;
  const prns = `${profileA.prn || '—'} · ${profileB.prn || '—'}`;

  const { marriageId } = await withTransaction(async (tx) => {
    const id = await insert(
      tx,
      `INSERT INTO marriages (ghotokId, pairLabel, prns, weddingDate, brideFee, groomFee, agreedAmount, receivedAmount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ghotok.id, pairLabel, prns, weddingDate, brideFee, groomFee, agreedAmount, receivedAmount, status]
    );
    await tx.execute("UPDATE profiles SET status = 'MARRIED' WHERE id IN (?, ?)", [profileAId, profileBId]);
    await tx.execute('UPDATE ghotoks SET marriagesClosed = marriagesClosed + 1 WHERE id = ?', [ghotok.id]);
    return { marriageId: id };
  });

  const m = await queryOne('SELECT * FROM marriages WHERE id = ?', [marriageId]);
  const updatedGhotok = await queryOne('SELECT marriagesClosed FROM ghotoks WHERE id = ?', [ghotok.id]);
  return res.status(201).json({
    marriage: { id: m.id, pair: m.pairLabel, prns: m.prns, date: m.weddingDate, agreed: m.agreedAmount, received: m.receivedAmount, status: m.status },
    marriagesClosed: updatedGhotok.marriagesClosed,
  });
});

// ── testimonials (commission page rail) ──
app.get('/api/testimonials', requireAuth, requireRole('GHOTOK'), async (req, res) => {
  const ghotok = await ghotokForReq(req);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  const rows = await query(
    'SELECT quote, byLabel, monthLabel FROM testimonials WHERE ghotokId = ? ORDER BY createdAt DESC',
    [ghotok.id]
  );
  return res.json({ testimonials: rows });
});

// ── admin moderation ──
const TIER_LIMIT = { SOLO: 20, BUREAU: 50, AGENCY: 150 };

const paymentWhen = (d) => {
  const dt = new Date(d);
  const now = new Date();
  const hhmm = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(dt, now)) return `Today ${hhmm}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(dt, yesterday)) return `Yesterday ${hhmm}`;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${hhmm}`;
};

// A report's subjectRef is a ghotok code (GHT-…) or a profile PRN — resolve
// it so "Suspend" has something real to act on and the dialog can show a
// true profile count instead of a guess.
async function resolveReportSubject(subjectRef) {
  if (/^GHT-/i.test(subjectRef)) {
    const g = await queryOne('SELECT id, userId FROM ghotoks WHERE code = ? LIMIT 1', [subjectRef]);
    if (g) {
      const cnt = await queryOne('SELECT COUNT(*) AS n FROM profiles WHERE managedByGhotokId = ?', [g.id]);
      return { type: 'ghotok', ghotokId: g.id, userId: g.userId, profileCount: cnt.n };
    }
  }
  if (/^PRN-/i.test(subjectRef)) {
    const p = await queryOne('SELECT id FROM profiles WHERE prn = ? LIMIT 1', [subjectRef]);
    if (p) return { type: 'profile', profileId: p.id, profileCount: 1 };
  }
  return { type: 'unknown', profileCount: 0 };
}

const weekLabelShort = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

// ── verification queue ──
app.get('/api/admin/verifications', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const V_STATUS = { PENDING: null, APPROVED: 'approved', MORE_INFO: 'more', REJECTED: 'rejected' };
  const rows = await query(
    `SELECT v.id, v.status, v.note, v.appliedAt, g.id AS ghotokId, g.code AS gid, g.district, gu.fullName AS name,
            (SELECT COUNT(*) FROM profiles WHERE managedByGhotokId = g.id) AS profileCount
       FROM verifications v
       JOIN ghotoks g ON v.ghotokId = g.id
       JOIN users gu ON g.userId = gu.id
      ORDER BY v.appliedAt ASC`
  );
  const ids = rows.map((r) => r.id);
  const checkRows = ids.length
    ? await query(`SELECT verificationId, label, passed, note FROM verification_checks WHERE verificationId IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids)
    : [];
  const checksByV = {};
  for (const c of checkRows) (checksByV[c.verificationId] ||= []).push({ label: c.label, ok: Boolean(c.passed), note: c.note });

  return res.json({
    verifications: rows.map((v) => ({
      id: v.id,
      init: initialsOf(v.name),
      name: v.name,
      gid: v.gid,
      meta: `${v.district} · applied ${weekLabelShort(v.appliedAt)} · ${v.profileCount} profile${v.profileCount === 1 ? '' : 's'}`,
      note: v.note || '',
      status: V_STATUS[v.status] ?? null,
      checks: checksByV[v.id] || [],
    })),
  });
});

// body: { decision: 'APPROVE' | 'MORE_INFO' | 'REJECT' }
app.patch('/api/admin/verifications/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const decision = req.body?.decision;
  const MAP = { APPROVE: 'APPROVED', MORE_INFO: 'MORE_INFO', REJECT: 'REJECTED' };
  if (!MAP[decision]) return bad(res, 'decision must be APPROVE, MORE_INFO, or REJECT.');
  const v = await queryOne('SELECT * FROM verifications WHERE id = ? LIMIT 1', [req.params.id]);
  if (!v) return bad(res, 'Verification not found.', 404);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE verifications SET status = ? WHERE id = ?', [MAP[decision], v.id]);
    if (decision === 'APPROVE') {
      await tx.execute('UPDATE ghotoks SET verified = 1 WHERE id = ?', [v.ghotokId]);
    }
    if (decision === 'REJECT') {
      // Deactivate the account without touching their data — a real,
      // reversible action; we don't delete anything on a moderation decision.
      const g = await queryOne('SELECT userId FROM ghotoks WHERE id = ?', [v.ghotokId]);
      if (g) await tx.execute('UPDATE users SET isActive = 0 WHERE id = ?', [g.userId]);
    }
  });
  return res.json({ ok: true, status: MAP[decision] });
});

// ── reports queue ──
app.get('/api/admin/reports', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const R_STATUS = { OPEN: null, SUSPENDED: 'suspended', WARNED: 'warned', DISMISSED: 'dismissed' };
  const TONE = { SERIOUS: 'error', MODERATE: 'warning', MINOR: 'neutral' };
  const rows = await query('SELECT * FROM reports ORDER BY createdAt DESC');
  const ids = rows.map((r) => r.id);
  const evRows = ids.length
    ? await query(`SELECT reportId, text FROM report_evidence WHERE reportId IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids)
    : [];
  const evByReport = {};
  for (const e of evRows) (evByReport[e.reportId] ||= []).push(e.text);

  const reports = await Promise.all(rows.map(async (r) => {
    const subject = await resolveReportSubject(r.subjectRef);
    return {
      id: r.id,
      title: r.title,
      subject: r.subjectRef,
      severity: capWord(r.severity),
      tone: TONE[r.severity] || 'neutral',
      by: r.reportedBy,
      when: relativeTime(r.createdAt),
      body: r.body,
      evidence: evByReport[r.id] || [],
      status: R_STATUS[r.status] ?? null,
      affectedProfileCount: subject.profileCount,
    };
  }));
  return res.json({ reports });
});

// body: { decision: 'SUSPEND' | 'WARN' | 'DISMISS' }
app.patch('/api/admin/reports/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const decision = req.body?.decision;
  const MAP = { SUSPEND: 'SUSPENDED', WARN: 'WARNED', DISMISS: 'DISMISSED' };
  if (!MAP[decision]) return bad(res, 'decision must be SUSPEND, WARN, or DISMISS.');
  const r = await queryOne('SELECT * FROM reports WHERE id = ? LIMIT 1', [req.params.id]);
  if (!r) return bad(res, 'Report not found.', 404);

  let affectedProfileCount = 0;
  await withTransaction(async (tx) => {
    await tx.execute('UPDATE reports SET status = ? WHERE id = ?', [MAP[decision], r.id]);
    if (decision === 'SUSPEND') {
      const subject = await resolveReportSubject(r.subjectRef);
      affectedProfileCount = subject.profileCount;
      if (subject.type === 'ghotok') {
        await tx.execute('UPDATE users SET isActive = 0 WHERE id = ?', [subject.userId]);
        await tx.execute("UPDATE profiles SET status = 'PAUSED' WHERE managedByGhotokId = ?", [subject.ghotokId]);
      } else if (subject.type === 'profile') {
        await tx.execute("UPDATE profiles SET status = 'PAUSED' WHERE id = ?", [subject.profileId]);
      }
    }
  });
  return res.json({ ok: true, status: MAP[decision], affectedProfileCount });
});

// ── platform payments queue ──
app.get('/api/admin/payments', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const P_STATUS = { PENDING: null, CONFIRMED: 'confirmed', FLAGGED: 'flagged' };
  const METHOD_LABEL = { BKASH: 'bKash', NAGAD: 'Nagad', ROCKET: 'Rocket' };
  const rows = await query(
    `SELECT p.*, g.code AS gid, gu.fullName AS name
       FROM payments p JOIN ghotoks g ON p.ghotokId = g.id JOIN users gu ON g.userId = gu.id
      ORDER BY p.paidAt DESC`
  );
  return res.json({
    payments: rows.map((p) => ({
      id: p.id,
      name: p.name,
      gid: p.gid,
      txn: p.transactionId,
      method: METHOD_LABEL[p.method] || p.method,
      amount: `৳${Number(p.amount).toLocaleString('en-US')}`,
      tier: capWord(p.tier),
      when: paymentWhen(p.paidAt),
      status: P_STATUS[p.status] ?? null,
    })),
  });
});

// body: { decision: 'CONFIRMED' | 'FLAGGED' }
app.patch('/api/admin/payments/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const decision = req.body?.decision;
  if (!['CONFIRMED', 'FLAGGED'].includes(decision)) return bad(res, 'decision must be CONFIRMED or FLAGGED.');
  const p = await queryOne('SELECT * FROM payments WHERE id = ? LIMIT 1', [req.params.id]);
  if (!p) return bad(res, 'Payment not found.', 404);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE payments SET status = ? WHERE id = ?', [decision, p.id]);
    if (decision === 'CONFIRMED') {
      await tx.execute('UPDATE ghotoks SET tier = ?, activeProfileLimit = ? WHERE id = ?', [p.tier, TIER_LIMIT[p.tier] || 20, p.ghotokId]);
    }
  });
  return res.json({ ok: true, status: decision });
});

// ── my profile (guardian / candidate self-view) ──
// Resolves the single profile this account has standing over: the one a
// guardian manages, or the candidate's own biodata. selfManaged mirrors
// profiles.managerType === 'SELF' — a self-signed-up bride/groom decides for
// themselves; a candidate whose profile a ghotok or guardian manages does not.
async function myProfileForReq(req) {
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

app.get('/api/my-profile', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ profile: null, selfManaged: false });
  return res.json({
    profile: { id: me.profile.id, name: me.profile.fullName, init: initialsOf(me.profile.fullName), prn: me.profile.prn },
    selfManaged: me.selfManaged,
  });
});

app.get('/api/my-profile/proposals', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ proposals: [] });
  const rows = await query(`${INTEREST_SELECT} WHERE i.yourProfileId = ? ORDER BY i.createdAt DESC`, [me.profile.id]);
  return res.json({ proposals: rows.map(interestItem) });
});

app.get('/api/my-profile/activity', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ activity: [] });
  const rows = await query('SELECT text, occurredAt FROM activity_log WHERE profileId = ? ORDER BY occurredAt DESC LIMIT 10', [me.profile.id]);
  return res.json({ activity: rows.map((a) => ({ text: a.text, when: relativeTime(a.occurredAt) })) });
});

// body: { decision: 'ACCEPT' | 'DECLINE' }
// A candidate may only decide when their profile is self-managed — otherwise
// their manager (ghotok or guardian) is the one who decides, elsewhere.
app.patch('/api/my-profile/proposals/:id', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return bad(res, 'No profile is linked to this account.', 403);
  if (req.auth.role === 'CANDIDATE' && !me.selfManaged) return bad(res, 'Your manager decides this for you.', 403);

  const decision = req.body?.decision;
  if (!['ACCEPT', 'DECLINE'].includes(decision)) return bad(res, 'decision must be ACCEPT or DECLINE.');
  const interest = await queryOne('SELECT * FROM interests WHERE id = ? AND yourProfileId = ? LIMIT 1', [req.params.id, me.profile.id]);
  if (!interest) return bad(res, 'Proposal not found.', 404);

  const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  const declineReason = decision === 'DECLINE' ? 'Not the right fit at this time.' : null;

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE interests SET status = ?, declineReason = ? WHERE id = ?', [status, declineReason, interest.id]);
    if (status === 'ACCEPTED' && interest.kind === 'INTEREST') {
      await tx.execute(
        "UPDATE profiles SET status = 'IN_DISCUSSION' WHERE id IN (?, ?) AND status = 'ACTIVE'",
        [interest.theirProfileId, interest.yourProfileId]
      );
    }
  });

  const [row] = await query(`${INTEREST_SELECT} WHERE i.id = ?`, [interest.id]);
  return res.json({ proposal: interestItem(row) });
});

// ── send interest (guardian / self-managed candidate) ──
// A guardian always decides for the profile they manage; a candidate only
// when selfManaged (see myProfileForReq) — otherwise their guardian sends it.
// body: { targetProfileId, message? }
app.post('/api/interests', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return bad(res, 'No profile is linked to this account.', 403);
  if (req.auth.role === 'CANDIDATE' && !me.selfManaged) return bad(res, 'Your guardian sends interest on your behalf.', 403);

  const targetProfileId = Number(req.body?.targetProfileId);
  if (!targetProfileId) return bad(res, 'targetProfileId is required.');
  if (targetProfileId === me.profile.id) return bad(res, 'You cannot send interest to your own profile.');
  const target = await queryOne('SELECT id FROM profiles WHERE id = ? LIMIT 1', [targetProfileId]);
  if (!target) return bad(res, 'Profile not found.', 404);

  const already = await queryOne(
    "SELECT id FROM interests WHERE theirProfileId = ? AND yourProfileId = ? AND kind = 'INTEREST' AND status = 'PENDING' LIMIT 1",
    [me.profile.id, targetProfileId]
  );
  if (already) return bad(res, 'Interest already sent and awaiting a reply.', 409);

  const message = String(req.body?.message || '').trim() || null;
  let fromGuardianId = null;
  let fromLabel;
  if (req.auth.role === 'GUARDIAN') {
    const guardian = await queryOne('SELECT * FROM guardians WHERE userId = ? LIMIT 1', [req.auth.sub]);
    if (!guardian) return bad(res, 'No guardian profile is linked to this account.', 403);
    fromGuardianId = guardian.id;
    const guardianUser = await queryOne('SELECT fullName FROM users WHERE id = ?', [req.auth.sub]);
    fromLabel = `Guardian — ${guardianUser?.fullName || ''}`.trim();
  } else {
    fromLabel = `${me.profile.fullName} (self)`;
  }

  const newId = await withTransaction((tx) => insert(
    tx,
    `INSERT INTO interests (kind, fromGhotokId, fromGuardianId, fromLabel, theirProfileId, yourProfileId, status, message)
     VALUES ('INTEREST', NULL, ?, ?, ?, ?, 'PENDING', ?)`,
    [fromGuardianId, fromLabel, me.profile.id, targetProfileId, message]
  ));
  const [row] = await query(`${INTEREST_SELECT} WHERE i.id = ?`, [newId]);
  return res.status(201).json({ interest: interestItem(row) });
});

// ── search: the pool visible to a guardian / self-managed candidate ──
// Same visibility rule as the ghotok's search (inNetworkPool = 1), minus the
// "your own book" concept — a guardian/candidate has exactly one profile,
// which is excluded from its own results.
app.get('/api/my-search', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ profiles: [] });
  if (req.auth.role === 'CANDIDATE' && !me.selfManaged) return bad(res, 'Your guardian searches on your behalf.', 403);

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
      WHERE p.id != ? AND p.inNetworkPool = 1 AND p.status = 'ACTIVE'
      ORDER BY p.lastUpdatedAt DESC`,
    [me.profile.id]
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

  return res.json({ profiles: rows.map((r) => searchProfile(r, null, prefsByProfile[r.id] || [])), myGender: me.profile.gender });
});

// ── full biodata detail for a guardian / candidate's own profile ──
app.get('/api/my-profile/biodata', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ profile: null });
  const p = me.profile;
  const prefs = await query('SELECT label, enabled FROM profile_preferences WHERE profileId = ? ORDER BY id', [p.id]);

  return res.json({
    profile: {
      id: p.id,
      prn: p.prn,
      name: p.fullName,
      gender: p.gender,
      age: yearsSince(p.dob),
      heightLabel: p.heightLabel,
      maritalStatus: p.maritalStatus,
      district: p.district,
      area: p.area,
      degree: p.degree,
      institution: p.institution,
      undergraduate: p.undergraduate,
      profession: p.profession,
      organisation: p.organisation,
      familyType: p.familyType,
      fatherInfo: p.fatherInfo,
      motherInfo: p.motherInfo,
      siblings: p.siblings,
      familyIncome: p.familyIncome,
      religion: p.religion,
      religiousPractice: p.religiousPractice,
      photoLocked: Boolean(p.photoLocked),
      inNetworkPool: Boolean(p.inNetworkPool),
      status: p.status,
      statusLabel: STATUS_LABEL[p.status] || p.status,
      completeness: p.completeness,
      preferences: prefs.map((r) => ({ label: r.label, enabled: Boolean(r.enabled) })),
    },
    selfManaged: me.selfManaged,
  });
});

// Fields a guardian / self-managed candidate may edit on their own biodata —
// identity basics (name, gender, dob, district) stay out of scope here, same
// as the ghotok's own PATCH /api/profiles/:id.
const BIODATA_EDITABLE = [
  'heightLabel', 'maritalStatus', 'area', 'degree', 'institution', 'undergraduate',
  'profession', 'organisation', 'familyType', 'fatherInfo', 'motherInfo', 'siblings',
  'familyIncome', 'religion', 'religiousPractice',
];
const completenessOf = (row) => Math.round(
  100 * BIODATA_EDITABLE.filter((f) => String(row[f] ?? '').trim() !== '').length / BIODATA_EDITABLE.length
);

// body: { ...BIODATA_EDITABLE fields, photoLocked?, inNetworkPool?, preferences?: [{label,enabled}], publish? }
// publish: true moves a DRAFT profile to ACTIVE and issues a PRN — the one
// step a self-signed-up candidate needs to become visible/searchable.
app.patch('/api/my-profile/biodata', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return bad(res, 'No profile is linked to this account.', 403);
  if (req.auth.role === 'CANDIDATE' && !me.selfManaged) return bad(res, 'Your guardian edits your biodata for you.', 403);

  const b = req.body || {};
  const merged = { ...me.profile };
  for (const f of BIODATA_EDITABLE) {
    if (f in b) merged[f] = b[f] === '' ? null : b[f];
  }
  if (b.familyType && !['NUCLEAR', 'JOINT'].includes(String(b.familyType).toUpperCase())) {
    return bad(res, 'familyType must be NUCLEAR or JOINT.');
  }

  const sets = BIODATA_EDITABLE.map((f) => `${f} = ?`);
  const params = BIODATA_EDITABLE.map((f) => merged[f] ?? null);
  sets.push('completeness = ?');
  params.push(completenessOf(merged));
  if (typeof b.photoLocked === 'boolean') { sets.push('photoLocked = ?'); params.push(b.photoLocked ? 1 : 0); }
  if (typeof b.inNetworkPool === 'boolean') { sets.push('inNetworkPool = ?'); params.push(b.inNetworkPool ? 1 : 0); }

  let newPrn = me.profile.prn;
  if (b.publish === true && me.profile.status === 'DRAFT') {
    newPrn = me.profile.prn || await nextPrn();
    sets.push('prn = ?', "status = 'ACTIVE'");
    params.push(newPrn);
  }
  sets.push('lastUpdatedAt = ?');
  params.push(new Date());

  await withTransaction(async (tx) => {
    await tx.execute(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`, [...params, me.profile.id]);
    if (Array.isArray(b.preferences)) {
      await tx.execute('DELETE FROM profile_preferences WHERE profileId = ?', [me.profile.id]);
      for (const p of b.preferences) {
        if (p && p.label) {
          await insert(tx, 'INSERT INTO profile_preferences (profileId, label, enabled) VALUES (?, ?, ?)', [me.profile.id, String(p.label), p.enabled ? 1 : 0]);
        }
      }
    }
  });

  const updated = await queryOne('SELECT * FROM profiles WHERE id = ?', [me.profile.id]);
  const prefs = await query('SELECT label, enabled FROM profile_preferences WHERE profileId = ? ORDER BY id', [me.profile.id]);
  return res.json({
    profile: {
      ...updated,
      age: yearsSince(updated.dob),
      statusLabel: STATUS_LABEL[updated.status] || updated.status,
      preferences: prefs.map((r) => ({ label: r.label, enabled: Boolean(r.enabled) })),
    },
  });
});

// A transparent, deterministic compatibility score against one candidate
// profile — not a learned model, but real arithmetic over real fields (no
// hardcoded pairs, unlike the ghotok console's mocked funnel/misses panels).
function scoreMatch(mine, cand) {
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

// ── AI matching for a guardian / self-managed candidate ──
// Computed on demand over the same visible pool as /api/my-search — no
// persisted suggestion table (that one is keyed to a ghotok's book).
app.get('/api/my-matches', requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ matches: [] });
  if (req.auth.role === 'CANDIDATE' && !me.selfManaged) return bad(res, 'Your guardian reviews matches on your behalf.', 403);

  const mine = me.profile;
  const opposite = mine.gender === 'MALE' ? 'FEMALE' : 'MALE';
  const rows = await query(
    "SELECT * FROM profiles WHERE gender = ? AND id != ? AND inNetworkPool = 1 AND status = 'ACTIVE' ORDER BY lastUpdatedAt DESC LIMIT 60",
    [opposite, mine.id]
  );

  const matches = rows
    .map((r) => {
      const { score, factors } = scoreMatch(mine, r);
      return {
        profileId: r.id,
        prn: r.prn,
        name: r.fullName,
        init: initialsOf(r.fullName),
        age: yearsSince(r.dob),
        edu: [r.degree, r.institution].filter(Boolean).join(', '),
        city: r.area || r.district,
        verified: Boolean(r.verified),
        score,
        factors,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return res.json({ matches });
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

// ── fallbacks ──
// Any route not matched above.
app.use((_req, res) => bad(res, 'Not found.', 404));

// Catches anything thrown/rejected in a route (e.g. the DB being unreachable)
// so the client always gets JSON, never Express's default HTML error page.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  bad(res, 'Something went wrong on our end. Please try again in a moment.', 500);
});

app.listen(PORT, () => {
  console.log(`SongiSathi API running at http://localhost:${PORT}`);
});
