// The interest/request feed: the joined query the inbox reads, and the view
// mapper that turns one row into a card.

import { query } from '../../db/pool.js';
import { initialsOf, yearsSince, capWord, relativeTime } from './format.js';

// The joined columns interestItem() expects — shared by the list views and the
// single-row refetch after a PATCH. Callers append their own WHERE / ORDER BY.
export const INTEREST_SELECT = `
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

// One interest, mapped — used to echo a row back after it is created or decided.
export async function interestById(id) {
  const [row] = await query(`${INTEREST_SELECT} WHERE i.id = ?`, [id]);
  return interestItem(row);
}

// A joined interest row → the shape the inbox UI expects.
export function interestItem(r) {
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
