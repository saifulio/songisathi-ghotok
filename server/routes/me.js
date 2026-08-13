// The guardian / bride / groom side of the app: your own profile, the
// proposals on it, the pool you can browse, and your own biodata.
//
// Standing, throughout: a guardian always decides for the profiles they
// manage; a candidate only when their profile is self-managed. Reading never
// needs standing — browsing and seeing your own biodata are open to every
// candidate — so each read reports canSendInterest / canEdit and the UI
// renders from it.
//
// A guardian holds up to GUARDIAN_PROFILE_LIMIT profiles (a daughter and a
// nephew are two separate searches), a candidate exactly one. Every route
// below acts on a single profile: the one named by ?profileId= / body
// profileId, or the first — memberOnly resolves it onto req.me, and refuses an
// id the account does not hold (see middleware.js).

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { STATUS_LABEL, initialsOf, yearsSince, relativeTime } from '../lib/format.js';
import { GUARDIAN_PROFILE_LIMIT, actingProfile, hasStanding } from '../lib/accounts.js';
import { INTEREST_SELECT, interestItem, interestById } from '../lib/interests.js';
import {
  POOL_PROFILE_SELECT, preferencesFor, searchProfile, markPairInDiscussion,
} from '../lib/profiles.js';
import { nextPrn } from '../lib/refs.js';
import { scoreMatch } from '../lib/matching.js';
import { memberPlan } from '../lib/subscriptions.js';
import { MEMBER_PREMIUM_MATCH_LIMIT } from '../config.js';
import { memberOnly } from '../middleware.js';

const router = express.Router();

const oppositeGender = (g) => (g === 'MALE' ? 'FEMALE' : 'MALE');

// The genders this account has any reason to browse: the opposite of each
// profile it holds. A guardian matchmaking for two daughters is only ever
// looking for grooms; one with a daughter and a nephew needs both, so the
// filter opens rather than guessing at one of them. A candidate holds a single
// profile, so this is the one gender opposite their own, as it always was.
const gendersToBrowse = (profiles) => [...new Set(profiles.map((p) => oppositeGender(p.gender)))];

// Fields a guardian / self-managed candidate may edit on their own biodata.
// Identity basics (name, gender, dob, district) are set when the profile is
// created and stay out of scope here, same as the ghotok's own
// PATCH /profiles/:id.
const BIODATA_EDITABLE = [
  'heightLabel', 'maritalStatus', 'area', 'degree', 'institution', 'undergraduate',
  'profession', 'organisation', 'familyType', 'fatherInfo', 'motherInfo', 'siblings',
  'familyIncome', 'religion', 'religiousPractice',
];
const completenessOf = (row) => Math.round(
  100 * BIODATA_EDITABLE.filter((f) => String(row[f] ?? '').trim() !== '').length / BIODATA_EDITABLE.length
);

// One entry in the profile switcher a guardian picks from.
const myProfileCard = (p) => ({
  id: p.id,
  name: p.fullName,
  init: initialsOf(p.fullName),
  prn: p.prn,
  gender: p.gender,
  status: p.status,
  statusLabel: STATUS_LABEL[p.status] || p.status,
  completeness: p.completeness,
});

// ── the profiles this account holds ──
// The switcher's source of truth: a guardian sees each family member they
// manage, a candidate sees the single profile that is their own.
router.get('/my-profiles', memberOnly, async (req, res) => {
  const limit = req.auth.role === 'GUARDIAN' ? GUARDIAN_PROFILE_LIMIT : 1;
  return res.json({
    profiles: req.myProfiles.map(myProfileCard),
    limit,
    canAdd: req.auth.role === 'GUARDIAN' && req.myProfiles.length < limit,
  });
});

// ── add a profile (guardian) ──
// A guardian adds the family member they are matchmaking for, up to
// GUARDIAN_PROFILE_LIMIT of them. The profile starts as a DRAFT with the
// guardian as its manager; publishing it (PATCH /my-profile/biodata with
// publish: true) issues the PRN and puts it in the pool — the same second step
// a self-signed-up candidate takes.
// body: { fullName, gender, dob?, heightLabel?, maritalStatus?, district, area?,
//         degree?, institution?, undergraduate?, profession?, organisation?,
//         familyType?, fatherInfo?, motherInfo?, siblings?, familyIncome?,
//         religion?, religiousPractice?, preferences?: [{label,enabled}] }
router.post('/my-profiles', memberOnly, async (req, res) => {
  if (req.auth.role !== 'GUARDIAN') {
    return bad(res, 'Your account has its own single profile — there is nothing to add.', 403);
  }
  if (!req.guardian) return bad(res, 'No guardian profile is linked to this account.', 403);
  if (req.myProfiles.length >= GUARDIAN_PROFILE_LIMIT) {
    return bad(
      res,
      `A guardian account holds up to ${GUARDIAN_PROFILE_LIMIT} profiles, and yours is full.`,
      409
    );
  }

  const b = req.body || {};
  const fullName = String(b.fullName || '').trim();
  if (!fullName) return bad(res, 'Full name is required.');
  const gender = ['MALE', 'FEMALE'].includes(b.gender) ? b.gender : null;
  if (!gender) return bad(res, 'Gender is required.');
  const district = String(b.district || '').trim();
  if (!district) return bad(res, 'District is required.');

  let dob = null;
  if (b.dob) {
    dob = new Date(b.dob);
    if (Number.isNaN(dob.getTime())) return bad(res, 'Date of birth is invalid.');
  }
  const familyType = ['NUCLEAR', 'JOINT'].includes(String(b.familyType || '').toUpperCase())
    ? String(b.familyType).toUpperCase()
    : null;

  // The optional biodata fields, kept on the same footing as the ones
  // PATCH /my-profile/biodata writes — including how completeness is counted,
  // so the figure doesn't jump the first time the guardian saves an edit.
  const optional = Object.fromEntries(
    BIODATA_EDITABLE.map((f) => [f, String(b[f] ?? '').trim() || null])
  );
  optional.familyType = familyType;
  optional.maritalStatus = optional.maritalStatus || 'Never married';

  const profileId = await withTransaction(async (tx) => {
    const id = await insert(
      tx,
      `INSERT INTO profiles
        (fullName, gender, dob, heightLabel, maritalStatus, district, area, degree, institution,
         undergraduate, profession, organisation, familyType, fatherInfo, motherInfo, siblings,
         familyIncome, religion, religiousPractice, managerType, managedByGuardianId,
         status, photoLocked, inNetworkPool, completeness)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GUARDIAN', ?, 'DRAFT', ?, ?, ?)`,
      [
        fullName, gender, dob, optional.heightLabel, optional.maritalStatus, district,
        optional.area, optional.degree, optional.institution, optional.undergraduate,
        optional.profession, optional.organisation, familyType, optional.fatherInfo,
        optional.motherInfo, optional.siblings, optional.familyIncome, optional.religion,
        optional.religiousPractice, req.guardian.id, true, false, completenessOf(optional),
      ]
    );
    if (Array.isArray(b.preferences)) {
      for (const p of b.preferences) {
        if (p && p.label) {
          await insert(
            tx,
            'INSERT INTO profile_preferences (profileId, label, enabled) VALUES (?, ?, ?)',
            [id, String(p.label), p.enabled ? 1 : 0]
          );
        }
      }
    }
    return id;
  });

  const profile = await queryOne('SELECT * FROM profiles WHERE id = ?', [profileId]);
  return res.status(201).json({
    profile: myProfileCard(profile),
    remaining: GUARDIAN_PROFILE_LIMIT - (req.myProfiles.length + 1),
  });
});

// ── my profile (guardian / candidate self-view) ──
router.get('/my-profile', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ profile: null, selfManaged: false });
  return res.json({
    profile: { id: me.profile.id, name: me.profile.fullName, init: initialsOf(me.profile.fullName), prn: me.profile.prn },
    selfManaged: me.selfManaged,
  });
});

router.get('/my-profile/proposals', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ proposals: [] });
  const rows = await query(`${INTEREST_SELECT} WHERE i.yourProfileId = ? ORDER BY i.createdAt DESC`, [me.profile.id]);
  return res.json({ proposals: rows.map(interestItem) });
});

router.get('/my-profile/activity', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ activity: [] });
  const rows = await query('SELECT text, occurredAt FROM activity_log WHERE profileId = ? ORDER BY occurredAt DESC LIMIT 10', [me.profile.id]);
  return res.json({ activity: rows.map((a) => ({ text: a.text, when: relativeTime(a.occurredAt) })) });
});

// body: { decision: 'ACCEPT' | 'DECLINE' }
router.patch('/my-profile/proposals/:id', memberOnly, async (req, res) => {
  const me = actingProfile(req, res, 'decides this for you.');
  if (!me) return;

  const decision = req.body?.decision;
  if (!['ACCEPT', 'DECLINE'].includes(decision)) return bad(res, 'decision must be ACCEPT or DECLINE.');
  const interest = await queryOne('SELECT * FROM interests WHERE id = ? AND yourProfileId = ? LIMIT 1', [req.params.id, me.profile.id]);
  if (!interest) return bad(res, 'Proposal not found.', 404);

  const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  const declineReason = decision === 'DECLINE' ? 'Not the right fit at this time.' : null;

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE interests SET status = ?, declineReason = ? WHERE id = ?', [status, declineReason, interest.id]);
    if (status === 'ACCEPTED' && interest.kind === 'INTEREST') {
      await markPairInDiscussion(tx, interest.theirProfileId, interest.yourProfileId);
    }
  });

  return res.json({ proposal: await interestById(interest.id) });
});

// Sending an interest lives in routes/interests.js: a ghotok does it too, and
// there is one act to implement rather than one per chair.

// ── search: the pool visible to a guardian / candidate ──
// Same visibility rule as the ghotok's search (inNetworkPool = 1), minus the
// "your own book" concept. Every profile the account holds is left out, not
// just the selected one — a guardian browsing for their daughter should not be
// shown their nephew.
//
// Gender is part of that visibility rule, not a filter: a bride's account is
// served grooms and nothing else. It used to be enforced only by the client
// pre-selecting the filter, which meant switching it to "Any" read the biodata
// of other brides — people this account has no business browsing. A ghotok's
// search is unchanged, since their book legitimately holds both.
router.get('/my-search', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ profiles: [], canSendInterest: false });

  const mineIds = req.myProfiles.map((p) => p.id);
  // Non-empty by the guard above: an account with no profiles never gets here,
  // and every profile it does hold contributes the gender opposite its own.
  const genders = gendersToBrowse(req.myProfiles);
  const rows = await query(
    `${POOL_PROFILE_SELECT}
      WHERE p.id NOT IN (${mineIds.map(() => '?').join(',')})
        AND p.gender IN (${genders.map(() => '?').join(',')})
        AND p.inNetworkPool = 1 AND p.status = 'ACTIVE'
      ORDER BY p.lastUpdatedAt DESC`,
    [...mineIds, ...genders]
  );

  const prefsByProfile = await preferencesFor(rows.map((r) => r.id));
  return res.json({
    profiles: rows.map((r) => searchProfile(r, null, prefsByProfile[r.id] || [])),
    // What the results above are limited to, so the UI can say so plainly
    // rather than offer a gender filter that would return nothing. Derived
    // from every profile the account holds, not just the selected one: a
    // guardian switching between two daughters is looking for grooms either
    // way, and one with a daughter and a nephew needs both.
    searchGenders: genders,
    canSendInterest: hasStanding(req, me),
    // The monthly interest allowance, so the page can say what is left before
    // the send button spends it (POST /interests enforces the same numbers).
    plan: await memberPlan(req.auth.sub, mineIds),
  });
});

// ── full biodata detail for a guardian / candidate's own profile ──
router.get('/my-profile/biodata', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ profile: null, canEdit: false });
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
    canEdit: hasStanding(req, me),
    managedBy: p.managerType === 'GHOTOK' ? 'your matchmaker' : p.managerType === 'GUARDIAN' ? 'your guardian' : null,
  });
});

// body: { ...BIODATA_EDITABLE fields, photoLocked?, inNetworkPool?, preferences?: [{label,enabled}], publish? }
// publish: true moves a DRAFT profile to ACTIVE and issues a PRN — the one
// step a self-signed-up candidate needs to become visible/searchable.
router.patch('/my-profile/biodata', memberOnly, async (req, res) => {
  const me = actingProfile(req, res, 'edits your biodata for you.');
  if (!me) return;

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

  // Publishing is "make searchable", so it implies pool membership — every
  // search filters on inNetworkPool = 1 AND status = 'ACTIVE', and a signup
  // leaves the profile out of the pool by default. Without this, publishing
  // hands out a PRN that nobody can ever find. A plain save still honours the
  // pool switch, so opting back out afterwards works as before.
  const publishing = b.publish === true && me.profile.status === 'DRAFT';
  const pool = publishing ? true : typeof b.inNetworkPool === 'boolean' ? b.inNetworkPool : null;
  if (pool !== null) { sets.push('inNetworkPool = ?'); params.push(pool ? 1 : 0); }

  if (publishing) {
    sets.push('prn = ?', "status = 'ACTIVE'");
    params.push(me.profile.prn || await nextPrn());
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

// ── AI matching for a guardian / candidate ──
// Computed on demand over the same visible pool as /my-search — no persisted
// suggestion table (that one is keyed to a ghotok's book). Readable by every
// candidate, on the same footing as the search it scores: the reasoning is all
// drawn from fields they can already see.
router.get('/my-matches', memberOnly, async (req, res) => {
  const me = req.me;
  if (!me) return res.json({ matches: [], canSendInterest: false });

  // Scoring is per profile, so this one reads the selected profile's gender
  // rather than the household's set — a match is suggested for one person.
  const mine = me.profile;
  const opposite = oppositeGender(mine.gender);
  const mineIds = req.myProfiles.map((p) => p.id);
  const rows = await query(
    `SELECT * FROM profiles
      WHERE gender = ? AND id NOT IN (${mineIds.map(() => '?').join(',')})
        AND inNetworkPool = 1 AND status = 'ACTIVE'
      ORDER BY lastUpdatedAt DESC LIMIT 60`,
    [opposite, ...mineIds]
  );

  // How far down the scored list this account may read: the free plan sees
  // the top few, Premium sees the whole shortlist. The rest are not sent at
  // all — a locked card the client could open in devtools is not a lock.
  const plan = await memberPlan(req.auth.sub, mineIds);

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
    .slice(0, MEMBER_PREMIUM_MATCH_LIMIT);

  return res.json({
    matches: matches.slice(0, plan.matchLimit),
    // What the free plan is holding back, so the page can say how many rather
    // than advertise Premium at an account that would gain nothing.
    lockedCount: Math.max(0, matches.length - plan.matchLimit),
    plan,
    canSendInterest: hasStanding(req, me),
  });
});

export default router;
