// The guardian / bride / groom side of the app: your own profile, the
// proposals on it, the pool you can browse, and your own biodata.
//
// Standing, throughout: a guardian always decides for the profile they manage;
// a candidate only when their profile is self-managed. Reading never needs
// standing — browsing and seeing your own biodata are open to every candidate
// — so each read reports canSendInterest / canEdit and the UI renders from it.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { STATUS_LABEL, initialsOf, yearsSince, relativeTime } from '../lib/format.js';
import { myProfileForReq, managerSubject } from '../lib/accounts.js';
import { INTEREST_SELECT, interestItem, interestById } from '../lib/interests.js';
import {
  POOL_PROFILE_SELECT, preferencesFor, searchProfile, markPairInDiscussion,
} from '../lib/profiles.js';
import { nextPrn } from '../lib/refs.js';
import { scoreMatch } from '../lib/matching.js';
import { memberOnly } from '../middleware.js';

const router = express.Router();

// Whether this account may act (not just look) on its profile.
const hasStanding = (req, me) => req.auth.role !== 'CANDIDATE' || me.selfManaged;

// The profile context for a route that acts. Returns null once it has already
// replied, so callers just `if (!me) return;`. `refusal` completes the
// sentence "Your matchmaker …" / "Your guardian …".
async function actingProfile(req, res, refusal) {
  const me = await myProfileForReq(req);
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

// ── my profile (guardian / candidate self-view) ──
router.get('/my-profile', memberOnly, async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ profile: null, selfManaged: false });
  return res.json({
    profile: { id: me.profile.id, name: me.profile.fullName, init: initialsOf(me.profile.fullName), prn: me.profile.prn },
    selfManaged: me.selfManaged,
  });
});

router.get('/my-profile/proposals', memberOnly, async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ proposals: [] });
  const rows = await query(`${INTEREST_SELECT} WHERE i.yourProfileId = ? ORDER BY i.createdAt DESC`, [me.profile.id]);
  return res.json({ proposals: rows.map(interestItem) });
});

router.get('/my-profile/activity', memberOnly, async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ activity: [] });
  const rows = await query('SELECT text, occurredAt FROM activity_log WHERE profileId = ? ORDER BY occurredAt DESC LIMIT 10', [me.profile.id]);
  return res.json({ activity: rows.map((a) => ({ text: a.text, when: relativeTime(a.occurredAt) })) });
});

// body: { decision: 'ACCEPT' | 'DECLINE' }
router.patch('/my-profile/proposals/:id', memberOnly, async (req, res) => {
  const me = await actingProfile(req, res, 'decides this for you.');
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

// ── send interest (guardian / self-managed candidate) ──
// body: { targetProfileId, message? }
router.post('/interests', memberOnly, async (req, res) => {
  const me = await actingProfile(req, res, 'sends interest on your behalf.');
  if (!me) return;

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
  return res.status(201).json({ interest: await interestById(newId) });
});

// ── search: the pool visible to a guardian / candidate ──
// Same visibility rule as the ghotok's search (inNetworkPool = 1), minus the
// "your own book" concept — a guardian/candidate has exactly one profile,
// which is excluded from its own results.
router.get('/my-search', memberOnly, async (req, res) => {
  const me = await myProfileForReq(req);
  if (!me) return res.json({ profiles: [], canSendInterest: false });

  const rows = await query(
    `${POOL_PROFILE_SELECT}
      WHERE p.id != ? AND p.inNetworkPool = 1 AND p.status = 'ACTIVE'
      ORDER BY p.lastUpdatedAt DESC`,
    [me.profile.id]
  );

  const prefsByProfile = await preferencesFor(rows.map((r) => r.id));
  return res.json({
    profiles: rows.map((r) => searchProfile(r, null, prefsByProfile[r.id] || [])),
    myGender: me.profile.gender,
    canSendInterest: hasStanding(req, me),
  });
});

// ── full biodata detail for a guardian / candidate's own profile ──
router.get('/my-profile/biodata', memberOnly, async (req, res) => {
  const me = await myProfileForReq(req);
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

// Fields a guardian / self-managed candidate may edit on their own biodata —
// identity basics (name, gender, dob, district) stay out of scope here, same
// as the ghotok's own PATCH /profiles/:id.
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
router.patch('/my-profile/biodata', memberOnly, async (req, res) => {
  const me = await actingProfile(req, res, 'edits your biodata for you.');
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
  const me = await myProfileForReq(req);
  if (!me) return res.json({ matches: [], canSendInterest: false });

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

  return res.json({ matches, canSendInterest: hasStanding(req, me) });
});

export default router;
