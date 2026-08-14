// The photo gallery: who may upload to a profile, who may look at it, and
// what a data URL has to be before it is allowed into the database.
//
// Two separate gates decide whether a viewer sees an image, and both must
// pass. Moderation is the first: an upload is PENDING until an admin passes
// it, and until then only its own manager (and the admin) ever sees it. The
// family's own choice is the second: profiles.photoLocked holds the whole
// gallery back until a manager on the other side asks for it and is granted
// an accepted PHOTO_REQUEST. Neither gate is a substitute for the other — an
// approved photo on a locked profile is still private, and unlocking a
// profile does not publish a photo the queue has not seen.

import { query, queryOne } from '../../db/pool.js';

// A phone camera's JPEG is a couple of megabytes; the client downscales
// before it posts (see src/lib/images.js), so anything arriving above this
// was not sent by our own uploader. Measured on the encoded data URL, which
// is what the column actually stores.
export const MAX_PHOTO_BYTES = 1_500_000;
export const MAX_PHOTOS_PER_PROFILE = 8;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The `data` column is a LONGTEXT holding the whole image, so every query
// that does not itself hand an image over names its columns and leaves it
// out. Reading a gallery's metadata should not drag megabytes with it.
const META = 'id, profileId, status, mimeType, byteSize, reviewNote, reviewedAt, createdAt';

// Reads a data URL the client posted. Returns { dataUrl, mimeType, byteSize }
// or { error } — the caller replies with the message as-is.
export function readDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) {
    return { error: 'Send the photograph as a data URL.' };
  }
  const match = /^data:([a-z0-9.+/-]+);base64,([a-z0-9+/=]+)$/i.exec(value.trim());
  if (!match) return { error: 'That file could not be read as an image.' };

  const [, mimeType, base64] = match;
  if (!ALLOWED_TYPES.includes(mimeType.toLowerCase())) {
    return { error: 'Photographs must be JPEG, PNG, or WebP.' };
  }
  const byteSize = Buffer.byteLength(value, 'utf8');
  if (byteSize > MAX_PHOTO_BYTES) {
    return { error: 'That photograph is too large. Try a smaller one.' };
  }
  // base64 that decodes to nothing is a truncated read on the client side,
  // not a picture — better to refuse it than to store an unopenable row.
  if (Buffer.from(base64, 'base64').length < 100) {
    return { error: 'That file did not come through. Try picking it again.' };
  }
  return { dataUrl: value, mimeType: mimeType.toLowerCase(), byteSize };
}

const STATUS_LABEL = {
  PENDING: 'Waiting for review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
};

// A row → what a manager sees in their own studio: every photo they hold,
// whatever the queue has decided, so a rejection can be read and replaced.
export const managerPhoto = (r, withImage = false) => ({
  id: r.id,
  status: r.status,
  statusLabel: STATUS_LABEL[r.status] || r.status,
  reviewNote: r.reviewNote || null,
  byteSize: r.byteSize,
  ...(withImage ? { src: r.data } : {}),
});

// The manager's gallery for one profile, images included — it is their own
// photograph and they are the one who uploaded it.
export async function galleryForManager(profileId) {
  const rows = await query(
    `SELECT ${META}, data FROM profile_photos WHERE profileId = ? ORDER BY id`,
    [profileId]
  );
  return rows.map((r) => managerPhoto(r, true));
}

// Whether this viewer has been granted the photographs of `profileId` —
// an accepted PHOTO_REQUEST naming that profile, sent by a profile they hold
// (a family) or by them (a ghotok). Mirrors what the guardian's proposals
// page derives client-side from the same rows.
async function hasPhotoGrant(viewer, profileId) {
  if (viewer.ghotokId) {
    const row = await queryOne(
      `SELECT id FROM interests
        WHERE kind = 'PHOTO_REQUEST' AND status = 'ACCEPTED'
          AND theirProfileId = ? AND fromGhotokId = ? LIMIT 1`,
      [profileId, viewer.ghotokId]
    );
    return Boolean(row);
  }
  if (!viewer.profileIds?.length) return false;
  const marks = viewer.profileIds.map(() => '?').join(',');
  const row = await queryOne(
    `SELECT id FROM interests
      WHERE kind = 'PHOTO_REQUEST' AND status = 'ACCEPTED'
        AND theirProfileId = ? AND yourProfileId IN (${marks}) LIMIT 1`,
    [profileId, ...viewer.profileIds]
  );
  return Boolean(row);
}

// What someone looking at another family's profile may see.
//
// `viewer` is { ghotokId } for a matchmaker or { profileIds } for a family.
// A manager looking at their own profile does not come through here — they
// have galleryForManager, which shows the pending ones too.
//
// The reply is deliberately the same shape either way: a locked gallery still
// reports how many photographs exist, because "there are three, held back" is
// what makes asking for them worth doing. It just never carries the images.
export async function galleryForViewer(profile, viewer) {
  const approved = await query(
    `SELECT ${META}, data FROM profile_photos
      WHERE profileId = ? AND status = 'APPROVED' ORDER BY id`,
    [profile.id]
  );
  const count = approved.length;
  if (!profile.photoLocked) {
    return { locked: false, granted: false, count, photos: approved.map((r) => ({ id: r.id, src: r.data })) };
  }
  const granted = await hasPhotoGrant(viewer, profile.id);
  return {
    locked: !granted,
    granted,
    count,
    photos: granted ? approved.map((r) => ({ id: r.id, src: r.data })) : [],
  };
}

// The viewer descriptor the gallery endpoints build from a request. A ghotok
// asks as themselves; a family asks as the profiles they hold.
export const viewerFor = (req) => (
  req.auth.role === 'GHOTOK'
    ? { ghotokId: req.ghotok?.id ?? null }
    : { profileIds: (req.myProfiles || []).map((p) => p.id) }
);

// Whether this request manages `profile` — the one check that decides who may
// upload to a gallery and delete from it. A ghotok manages the profiles in
// their book; a family manages the ones on their account, except that a
// candidate whose biodata someone else runs only reads it (hasStanding).
export function managesProfile(req, profile) {
  if (!profile) return false;
  if (req.auth.role === 'GHOTOK') return profile.managedByGhotokId === req.ghotok?.id;
  const mine = (req.myProfiles || []).some((p) => p.id === profile.id);
  if (!mine) return false;
  return req.auth.role !== 'CANDIDATE' || profile.managerType === 'SELF';
}
