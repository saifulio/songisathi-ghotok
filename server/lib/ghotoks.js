// The matchmaker directory a family searches, and the management requests
// they send into it: the joined queries and the view mappers both sides read.
//
// A family finding a ghotok is the mirror of a ghotok finding a candidate.
// What they are shown is only what a ghotok already publishes about
// themselves — the bureau, the district, the seal, the closed marriages, and
// the fee they ask. No profile from anyone's book is visible here.

import { query } from '../../db/pool.js';
import { initialsOf, capWord, relativeTime } from './format.js';

// The columns ghotokCard() reads. Callers append their own WHERE / ORDER BY.
// The two counts are what a family is actually judging: how many families
// this matchmaker is already carrying, and how many they have closed.
export const GHOTOK_DIRECTORY_SELECT = `
  SELECT g.id, g.code, g.bureauName, g.district, g.tier, g.verified, g.serviceFee,
         g.marriagesClosed, g.yearsActive, g.memberSince, g.activeProfileLimit,
         u.fullName AS ghotokName,
         (SELECT COUNT(*) FROM profiles p
           WHERE p.managedByGhotokId = g.id
             AND p.status NOT IN ('DRAFT','MARRIED','AUTO_ARCHIVED')) AS activeProfiles
    FROM ghotoks g
    JOIN users u ON g.userId = u.id
`;

// A directory row → the card the "find a matchmaker" page renders.
// `homeDistrict` is the district of the profile doing the searching, so the
// page can say which of these are nearby without a second query; `request` is
// this profile's own request to this ghotok, when there is one.
export function ghotokCard(r, homeDistrict, request = null) {
  const full = Number(r.activeProfiles) >= r.activeProfileLimit;
  return {
    id: r.id,
    name: r.ghotokName,
    init: initialsOf(r.ghotokName),
    code: r.code,
    bureauName: r.bureauName,
    district: r.district,
    nearby: Boolean(homeDistrict) && r.district === homeDistrict,
    tier: capWord(r.tier),
    verified: Boolean(r.verified),
    // 0 means no published figure. The page prints that as "fee on asking"
    // rather than as free — a matchmaker who has not named one still charges.
    serviceFee: r.serviceFee,
    marriagesClosed: r.marriagesClosed,
    yearsActive: r.yearsActive,
    memberSince: r.memberSince,
    profilesManaged: Number(r.activeProfiles),
    // Their plan is full, so accepting would be refused. Said up front rather
    // than after the family has waited a week for the answer.
    full,
    request,
  };
}

// The joined columns managementRequestItem() expects — shared by the family's
// list, the ghotok's inbox, and the single-row refetch after a decision.
export const MANAGEMENT_REQUEST_SELECT = `
  SELECT m.id, m.status, m.message, m.feeAmount, m.declineReason, m.createdAt, m.decidedAt,
         m.profileId, m.ghotokId,
         p.prn AS profilePrn, p.fullName AS profileName, p.gender AS profileGender,
         p.dob AS profileDob, p.degree AS profileDegree, p.institution AS profileInstitution,
         p.area AS profileArea, p.district AS profileDistrict, p.status AS profileStatus,
         p.completeness AS profileCompleteness, p.managerType AS profileManagerType,
         g.code AS ghotokCode, g.bureauName AS ghotokBureau, g.district AS ghotokDistrict,
         g.marriagesClosed AS ghotokMarriages, g.verified AS ghotokVerified,
         gu.fullName AS ghotokName,
         ru.fullName AS requestedByName, ru.role AS requestedByRole
    FROM management_requests m
    JOIN profiles p ON m.profileId = p.id
    JOIN ghotoks  g ON m.ghotokId = g.id
    JOIN users   gu ON g.userId = gu.id
    JOIN users   ru ON m.requestedByUserId = ru.id
`;

// One request, mapped — used to echo a row back after it is sent or decided.
export async function managementRequestById(id) {
  const [row] = await query(`${MANAGEMENT_REQUEST_SELECT} WHERE m.id = ?`, [id]);
  return row ? managementRequestItem(row) : null;
}

// A joined request row → the shape both sides render. The same object serves
// the family's "requests you have sent" list and the ghotok's inbox; each side
// reads the half it cares about.
export function managementRequestItem(r) {
  const askedBy = r.requestedByRole === 'GUARDIAN'
    ? `Guardian — ${r.requestedByName}`
    : `${r.requestedByName} (self-managed)`;
  return {
    id: r.id,
    status: String(r.status).toLowerCase(),
    fee: r.feeAmount,
    message: r.message || '',
    declineReason: r.declineReason || null,
    when: relativeTime(r.createdAt),
    decided: r.decidedAt ? relativeTime(r.decidedAt) : null,

    profileId: r.profileId,
    profileName: r.profileName,
    profilePrn: r.profilePrn,
    profileInit: initialsOf(r.profileName),
    profileGender: r.profileGender,
    profileMeta: [
      [r.profileDegree, r.profileInstitution].filter(Boolean).join(', '),
      [r.profileArea, r.profileDistrict].filter(Boolean).join(', '),
    ].filter(Boolean).join(' · '),
    profileCompleteness: r.profileCompleteness,
    profileStatus: r.profileStatus,
    // Whether the profile is still where it was when the request was sent —
    // a family may have found someone else in the meantime.
    profileManagerType: r.profileManagerType,
    askedBy,

    ghotokId: r.ghotokId,
    ghotokName: r.ghotokName,
    ghotokInit: initialsOf(r.ghotokName),
    ghotokMeta: [r.ghotokBureau || r.ghotokCode, r.ghotokDistrict].filter(Boolean).join(' · '),
    ghotokVerified: Boolean(r.ghotokVerified),
    ghotokMarriages: r.ghotokMarriages,
  };
}
