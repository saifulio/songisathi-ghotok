// Profile view mappers, plus the shared SQL the two search endpoints
// (ghotok and guardian/candidate) both read from.

import { query, queryOne } from '../../db/pool.js';
import { STATUS_LABEL, initialsOf, yearsSince, daysSince, capWord, eduLevelOf } from './format.js';

// What fills a place on a ghotok's plan: every profile they manage except a
// draft, a closed marriage, and one the 90-day clock archived. The dashboard
// meter and the limit check read this same definition, so the number a ghotok
// is shown is the number they are held to.
export async function countActiveProfiles(ghotokId) {
  const row = await queryOne(
    "SELECT COUNT(*) AS n FROM profiles WHERE managedByGhotokId = ? AND status NOT IN ('DRAFT','MARRIED','AUTO_ARCHIVED')",
    [ghotokId]
  );
  return row?.n ?? 0;
}

// The refusal a ghotok gets when their plan is full, or null when it is not.
// Checked wherever a profile becomes active — publishing a new one, and
// attesting an archived one back to life.
export async function planFullRefusal(ghotok) {
  const used = await countActiveProfiles(ghotok.id);
  if (used < ghotok.activeProfileLimit) return null;
  return `Your ${capWord(ghotok.tier)} plan covers ${ghotok.activeProfileLimit} active profiles and all ${ghotok.activeProfileLimit} are in use. Free a place first — a draft costs you nothing in the meantime.`;
}

// A DB profile row → the shape the ghotok's book / dashboard table expects.
export function profileCard(p) {
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
export const suggestionPerson = (p) => ({
  init: initialsOf(p.fullName), name: p.fullName, age: yearsSince(p.dob),
  job: p.profession, city: p.area || p.district,
  edu: [p.degree, p.institution].filter(Boolean).join(', '),
});

// Every column searchProfile() reads, with each manager kind joined in.
// Callers append their own WHERE and ORDER BY.
export const POOL_PROFILE_SELECT = `
  SELECT p.*,
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
`;

// Enabled "looking for" labels for a set of profiles, keyed by profileId.
export async function preferencesFor(ids) {
  const byProfile = {};
  if (!ids.length) return byProfile;
  const rows = await query(
    `SELECT profileId, label FROM profile_preferences WHERE enabled = 1 AND profileId IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  for (const r of rows) (byProfile[r.profileId] ||= []).push(r.label);
  return byProfile;
}

// Who runs a profile, as the two lines every view of it shows: the manager's
// name and the meta beneath. `mine` is whether the reader is that manager —
// their own book says how many marriages it has closed, someone else's book
// is just a pool member.
export function managerOf(r, mine) {
  if (r.managerType === 'GHOTOK') {
    return {
      managedBy: `${r.ghotokName || 'Ghotok'} (ghotok)`,
      mgrMeta: [r.ghotokCode, r.ghotokDistrict].filter(Boolean).join(' · ')
        + (mine ? ` · ${r.ghotokMarriages} marriages` : ' · pool member'),
    };
  }
  if (r.managerType === 'GUARDIAN') {
    return {
      managedBy: `Guardian — ${r.guardianName || ''}`.trim(),
      mgrMeta: [r.guardianRelation, 'self-managed family'].filter(Boolean).join(' · '),
    };
  }
  return { managedBy: `${r.candidateName || r.fullName} (self)`, mgrMeta: 'Self-managed' };
}

// A POOL_PROFILE_SELECT row → the shape the search UI expects. myGhotokId is
// null for a guardian / candidate, who has no book of their own.
export function searchProfile(r, myGhotokId, prefLabels) {
  const mine = r.managedByGhotokId === myGhotokId;
  const { managedBy, mgrMeta } = managerOf(r, mine);
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
    // Only ever ACTIVE for a member (their pool query says so); a ghotok also
    // sees their own book's other states, which decide whether a candidate can
    // still be put forward.
    status: r.status,
    mine,
    managedBy,
    mgrMeta,
    family: [capWord(r.familyType), r.fatherInfo].filter(Boolean).join(' · '),
    siblings: r.siblings || '—',
    religion: [r.religion, r.religiousPractice].filter(Boolean).join(' · ') || '—',
    looking: prefLabels.length ? prefLabels.join(', ') : '—',
  };
}

// A POOL_PROFILE_SELECT row → the whole profile, for the detail page.
//
// The search mapper above folds fields together for a card ("family" is family
// type and father's info joined); this one keeps them apart, because the detail
// page has room to name each one. What it still does not carry: the sealed
// screening answers (only that there are some), the date of birth (age is what
// a family is told), and contact details, which no read of a profile has ever
// returned — they are released by hand, from the interest, or not at all.
export function profileDetail(r, mine, prefLabels) {
  const { managedBy, mgrMeta } = managerOf(r, mine);
  const sealedCount = Number(r.sealedCount) || 0;
  return {
    id: r.id,
    prn: r.prn,
    name: r.fullName,
    gender: r.gender,
    genderLabel: r.gender === 'FEMALE' ? 'Bride' : 'Groom',
    age: yearsSince(r.dob),
    height: r.heightLabel,
    maritalStatus: r.maritalStatus,
    district: r.district,
    area: r.area,
    location: [r.area, r.district].filter(Boolean).join(', '),
    degree: r.degree,
    institution: r.institution,
    undergraduate: r.undergraduate,
    eduLevel: eduLevelOf(r.degree),
    profession: r.profession,
    organisation: r.organisation,
    familyType: r.familyType ? capWord(r.familyType) : null,
    fatherInfo: r.fatherInfo,
    motherInfo: r.motherInfo,
    siblings: r.siblings,
    familyIncome: r.familyIncome,
    religion: r.religion,
    religiousPractice: r.religiousPractice,
    verified: Boolean(r.verified),
    screened: sealedCount > 0,
    sealedCount,
    photoLocked: Boolean(r.photoLocked),
    inNetworkPool: Boolean(r.inNetworkPool),
    status: r.status,
    statusLabel: STATUS_LABEL[r.status] || r.status,
    completeness: r.completeness,
    updatedDays: daysSince(r.lastUpdatedAt),
    looking: prefLabels,
    mine,
    manager: { name: managedBy, meta: mgrMeta, type: r.managerType },
  };
}

// Accepting a match (a suggestion or an interest) nudges both sides into
// "in discussion" — but only from ACTIVE, so a married or paused profile is
// left alone. Runs on a transaction connection.
export const markPairInDiscussion = (tx, profileAId, profileBId) =>
  tx.execute(
    "UPDATE profiles SET status = 'IN_DISCUSSION' WHERE id IN (?, ?) AND status = 'ACTIVE'",
    [profileAId, profileBId]
  );
