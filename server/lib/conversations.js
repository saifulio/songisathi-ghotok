// Manager-to-manager conversations.
//
// Who may talk to whom is the product, not a detail: every message routes
// between the two people who manage a matched pair. A candidate never messages
// another family, and no manager reaches the other side's candidate. What this
// adds is the conversation that was already implied — the interest inbox says
// "manager to manager" under every note, and the admin console lists "message
// content between managers" among the things moderators cannot read.
//
// A conversation belongs to a pair of profiles rather than to the request that
// started it: the two managers are discussing the match, however many
// interests, photo requests, and release requests pass between them.

import { query, queryOne } from '../../db/pool.js';

// Every column needed to name a profile and work out who speaks for it.
const PROFILE_WITH_MANAGER = `
  SELECT p.id, p.fullName, p.prn, p.gender, p.managerType, p.candidateUserId,
         g.userId AS ghotokUserId, g.code AS ghotokCode, g.district AS ghotokDistrict,
         gd.userId AS guardianUserId, gd.relation AS guardianRelation
    FROM profiles p
    LEFT JOIN ghotoks g    ON p.managedByGhotokId = g.id
    LEFT JOIN guardians gd ON p.managedByGuardianId = gd.id
`;

// The one account that speaks for a profile. A candidate whose biodata a
// ghotok or guardian manages speaks for nothing — their manager holds the
// conversation, which is the same standing rule the rest of the API applies.
export const speakerOf = (p) => (
  p.managerType === 'GHOTOK' ? p.ghotokUserId
    : p.managerType === 'GUARDIAN' ? p.guardianUserId
      : p.candidateUserId
);

// A pair is the two profiles in it, whichever way round they were named.
const ordered = (a, b) => (a < b ? [a, b] : [b, a]);

// The profiles this account speaks for.
export function profilesSpokenForBy(userId) {
  return query(
    `${PROFILE_WITH_MANAGER}
      WHERE (p.managerType = 'GHOTOK'   AND g.userId  = ?)
         OR (p.managerType = 'GUARDIAN' AND gd.userId = ?)
         OR (p.managerType = 'SELF'     AND p.candidateUserId = ?)`,
    [userId, userId, userId]
  );
}

// A conversation opens once the two sides have agreed on something: any
// accepted request between them — an interest, a photo release, a contact
// release. A pending one is not enough, because declining with a reason is
// how a proposal is turned down, and a thread that opened on arrival would
// route around that. Rows are created here on read rather than at the accept,
// so a pair that agreed before this feature existed has its thread too, and so
// the rule lives in one place.
export async function ensureConversationsFor(userId) {
  const mine = await profilesSpokenForBy(userId);
  if (!mine.length) return [];
  const ids = mine.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');

  const accepted = await query(
    `SELECT theirProfileId, yourProfileId FROM interests
      WHERE status = 'ACCEPTED'
        AND (theirProfileId IN (${placeholders}) OR yourProfileId IN (${placeholders}))`,
    [...ids, ...ids]
  );

  for (const row of accepted) {
    const [a, b] = ordered(row.theirProfileId, row.yourProfileId);
    // The unique index on the pair is what makes this idempotent; INSERT
    // IGNORE lets two managers open the same thread at the same moment.
    await query('INSERT IGNORE INTO conversations (profileAId, profileBId) VALUES (?, ?)', [a, b]);
  }
  return mine;
}

// A conversation the caller is part of, with the two sides sorted into theirs
// and the other family's. Returns null when the conversation does not exist or
// this account has no standing in it — the caller reports both the same way,
// since "not yours" and "not there" are the same answer to an outsider.
export async function conversationForUser(conversationId, userId) {
  const conversation = await queryOne('SELECT * FROM conversations WHERE id = ? LIMIT 1', [conversationId]);
  if (!conversation) return null;

  const [a, b] = await Promise.all([
    queryOne(`${PROFILE_WITH_MANAGER} WHERE p.id = ?`, [conversation.profileAId]),
    queryOne(`${PROFILE_WITH_MANAGER} WHERE p.id = ?`, [conversation.profileBId]),
  ]);
  if (!a || !b) return null;

  const mine = speakerOf(a) === userId ? a : speakerOf(b) === userId ? b : null;
  if (!mine) return null;
  return { conversation, mine, theirs: mine.id === a.id ? b : a };
}

// How the other side is introduced: a name and the standing behind it, never
// the candidate's own account.
export const managerLabelOf = (p) => (
  p.managerType === 'GHOTOK' ? { role: 'Matchmaker', meta: [p.ghotokCode, p.ghotokDistrict].filter(Boolean).join(' · ') }
    : p.managerType === 'GUARDIAN' ? { role: 'Guardian', meta: p.guardianRelation || 'family' }
      : { role: 'Self-managed', meta: 'speaks for themselves' }
);

// Contact details are released by a deliberate, logged step, not typed into a
// message. Until that release is accepted for this pair, a message carrying
// what looks like a phone number or an email address is refused rather than
// quietly stripped — the sender should know their words did not go.
const CONTACT_PATTERNS = [
  { re: /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i, what: 'an email address' },
  { re: /(?:\+?\d[\s().-]*){7,}/, what: 'a phone number' },
];

export const contactDetailIn = (text) => CONTACT_PATTERNS.find((p) => p.re.test(text))?.what || null;

// Whether contact has been released between these two profiles, by the
// dedicated request kind the schema already carries.
export async function contactReleased(profileAId, profileBId) {
  const row = await queryOne(
    `SELECT id FROM interests
      WHERE kind = 'CONTACT_RELEASE' AND status = 'ACCEPTED'
        AND ((theirProfileId = ? AND yourProfileId = ?) OR (theirProfileId = ? AND yourProfileId = ?))
      LIMIT 1`,
    [profileAId, profileBId, profileBId, profileAId]
  );
  return Boolean(row);
}
