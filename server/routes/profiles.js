// The ghotok's book: adding a candidate, listing and searching profiles, and
// the biodata detail view.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { yearsSince } from '../lib/format.js';
import {
  profileCard, searchProfile, profileDetail, POOL_PROFILE_SELECT, preferencesFor, planFullRefusal,
} from '../lib/profiles.js';
import { nextPrn } from '../lib/refs.js';
import { requireAuth, ghotokOnly, managerOnly } from '../middleware.js';

const router = express.Router();

// ── screening questions (the sealed layer) ──
// The private questions shown in the Add-profile wizard, from the DB.
router.get('/screening-questions', requireAuth, async (_req, res) => {
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
router.post('/profiles', ghotokOnly, async (req, res) => {
  const b = req.body || {};

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

  // A draft is invisible and costs nothing; it is publishing that fills a
  // place on the plan, so that is where the limit is enforced. Checked before
  // any of the work below, so a refusal writes nothing.
  const publish = Boolean(b.publish);
  if (publish) {
    const refusal = await planFullRefusal(req.ghotok);
    if (refusal) return bad(res, refusal, 409);
  }
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
        familyType, b.religion || null, b.religiousPractice || null, req.ghotok.id,
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
router.get('/profiles', ghotokOnly, async (req, res) => {
  const rows = await query(
    'SELECT * FROM profiles WHERE managedByGhotokId = ? ORDER BY lastUpdatedAt DESC',
    [req.ghotok.id]
  );
  return res.json({ profiles: rows.map(profileCard) });
});

// ── search: the ghotok's book + the trusted-network pool ──
// Returns every profile this ghotok may see (their own, plus any pooled
// profile from another manager), as rich objects the search UI filters
// client-side. Drafts and auto-archived profiles are left out.
// Must stay ABOVE /profiles/:id — Express matches in declaration order, so
// with :id first the literal "search" is read as an id and this 404s.
router.get('/profiles/search', ghotokOnly, async (req, res) => {
  const rows = await query(
    `${POOL_PROFILE_SELECT}
      WHERE (p.managedByGhotokId = ? OR p.inNetworkPool = 1)
        AND p.status NOT IN ('DRAFT', 'AUTO_ARCHIVED')
      ORDER BY p.lastUpdatedAt DESC`,
    [req.ghotok.id]
  );

  const prefsByProfile = await preferencesFor(rows.map((r) => r.id));
  return res.json({
    profiles: rows.map((r) => searchProfile(r, req.ghotok.id, prefsByProfile[r.id] || [])),
  });
});

// ── one profile, in full, for whoever may read it ──
// The profile detail page, from either chair: a ghotok reading their own book
// or the pool, a family reading the pool or one of their own. Visibility is
// the same rule each side's search already applies — a ghotok sees their book
// plus anything pooled, a family sees their own plus anything pooled and
// active — so this route opens nothing that was not already findable.
//
// Declared above /profiles/:id only for company; Express matches the two
// paths distinctly either way.
router.get('/profiles/:id/detail', managerOnly, async (req, res) => {
  const rows = await query(`${POOL_PROFILE_SELECT} WHERE p.id = ? LIMIT 1`, [Number(req.params.id)]);
  const r = rows[0];
  if (!r) return bad(res, 'Profile not found.', 404);

  const isGhotok = req.auth.role === 'GHOTOK';
  const mine = isGhotok
    ? r.managedByGhotokId === req.ghotok.id
    : (req.myProfiles || []).some((p) => p.id === r.id);
  // A pooled profile is readable by anyone in the network; a ghotok also
  // reads their own book's drafts and archived profiles, which is where they
  // do the work of getting one ready.
  const pooled = Boolean(r.inNetworkPool)
    && (isGhotok ? !['DRAFT', 'AUTO_ARCHIVED'].includes(r.status) : r.status === 'ACTIVE');
  if (!mine && !pooled) return bad(res, 'That profile is not one you can see.', 403);

  const prefsByProfile = await preferencesFor([r.id]);
  return res.json({ profile: profileDetail(r, mine, prefsByProfile[r.id] || []) });
});

// ── full detail for one profile (biodata studio) ──
router.get('/profiles/:id', ghotokOnly, async (req, res) => {
  const p = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [req.params.id]);
  if (!p) return bad(res, 'Profile not found.', 404);
  if (p.managedByGhotokId !== req.ghotok.id) return bad(res, 'That profile is not in your book.', 403);

  const prefs = await query('SELECT label FROM profile_preferences WHERE profileId = ? AND enabled = 1 ORDER BY id', [p.id]);
  const managerUser = await queryOne('SELECT fullName FROM users WHERE id = ?', [req.ghotok.userId]);

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
    manager: { name: managerUser?.fullName || '', code: req.ghotok.code, district: req.ghotok.district },
  });
});

// ── update a profile (dashboard actions) ──
// body: { inNetworkPool?: bool, attest?: bool }
//   inNetworkPool — toggle trusted-network visibility.
//   attest — the ghotok confirms the profile is still active: reset the
//            90-day archive clock, and un-archive it if it had lapsed.
router.patch('/profiles/:id', ghotokOnly, async (req, res) => {
  const profile = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [req.params.id]);
  if (!profile) return bad(res, 'Profile not found.', 404);
  if (profile.managedByGhotokId !== req.ghotok.id) return bad(res, 'That profile is not in your book.', 403);

  const b = req.body || {};
  const sets = [];
  const params = [];
  if (typeof b.inNetworkPool === 'boolean') { sets.push('inNetworkPool = ?'); params.push(b.inNetworkPool ? 1 : 0); }
  if (b.attest === true) {
    sets.push('lastUpdatedAt = ?'); params.push(new Date());
    // Reviving a lapsed profile takes a place on the plan just as publishing a
    // new one does — the 90-day clock is what freed that place to begin with.
    if (profile.status === 'AUTO_ARCHIVED') {
      const refusal = await planFullRefusal(req.ghotok);
      if (refusal) return bad(res, refusal, 409);
      sets.push("status = 'ACTIVE'");
    }
  }
  if (!sets.length) return bad(res, 'Nothing to update.');
  await query(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`, [...params, profile.id]);

  const updated = await queryOne('SELECT * FROM profiles WHERE id = ?', [profile.id]);
  return res.json({ profile: profileCard(updated) });
});

export default router;
