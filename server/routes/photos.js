// The photo gallery's endpoints: a manager's own gallery, another family's
// view of it, and the moderation queue that stands between the two.
//
// Whether a photograph may be seen is decided in lib/photos.js, not here —
// these routes only establish who is asking. The one rule worth restating at
// this level: nothing in this file ever returns an unapproved image to
// anybody except the manager who uploaded it and an admin.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { relativeTime } from '../lib/format.js';
import { actingProfile } from '../lib/accounts.js';
import {
  MAX_PHOTOS_PER_PROFILE,
  readDataUrl,
  galleryForManager,
  galleryForViewer,
  managesProfile,
  viewerFor,
} from '../lib/photos.js';
import { adminOnly, managerOnly } from '../middleware.js';

const router = express.Router();

// The profile a manager route is acting on. Both audiences name it the same
// way they do everywhere else: a ghotok passes profileId (their book holds
// many), a family's comes from the switcher, which memberOnly has already
// resolved onto req.me — so a guardian with two daughters uploads to the one
// they are looking at, not to whichever came first.
async function readProfile(req) {
  if (req.auth.role !== 'GHOTOK') return req.me?.profile || null;
  const id = Number(req.query?.profileId ?? req.body?.profileId);
  if (!id) return null;
  return queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [id]);
}

// The same, for the routes that change something: replies and returns null
// unless this request may actually edit that gallery.
async function editableProfile(req, res) {
  const profile = await readProfile(req);
  if (!profile) { bad(res, 'No profile is linked to this account.', 403); return null; }
  if (req.auth.role === 'GHOTOK') {
    if (!managesProfile(req, profile)) { bad(res, 'That profile is not in your book.', 403); return null; }
    return profile;
  }
  // A candidate whose biodata someone else runs may look at their gallery but
  // not add to it — the same standing rule as the rest of their account.
  return actingProfile(req, res, 'manages the photographs on your profile.') ? profile : null;
}

// ── the gallery a manager sees of their own profile ──
// Pending and rejected ones included: they uploaded them, and a rejection is
// only useful if the person who can fix it can read it.
router.get('/my-gallery', managerOnly, async (req, res) => {
  const profile = await readProfile(req);
  if (!profile) return res.json({ photos: [], photoLocked: true, canEdit: false, limit: MAX_PHOTOS_PER_PROFILE });
  if (req.auth.role === 'GHOTOK' && profile.managedByGhotokId !== req.ghotok.id) {
    return bad(res, 'That profile is not in your book.', 403);
  }

  return res.json({
    photos: await galleryForManager(profile.id),
    photoLocked: Boolean(profile.photoLocked),
    canEdit: managesProfile(req, profile),
    limit: MAX_PHOTOS_PER_PROFILE,
  });
});

// ── upload one photograph ──
// body: { image: 'data:image/jpeg;base64,…', profileId? }
// It lands PENDING. Nobody outside this manager sees it until the queue does.
router.post('/my-gallery', managerOnly, async (req, res) => {
  const profile = await editableProfile(req, res);
  if (!profile) return undefined;

  const parsed = readDataUrl(req.body?.image);
  if (parsed.error) return bad(res, parsed.error);

  const held = await queryOne(
    "SELECT COUNT(*) AS n FROM profile_photos WHERE profileId = ? AND status <> 'REJECTED'",
    [profile.id]
  );
  if (held.n >= MAX_PHOTOS_PER_PROFILE) {
    return bad(res, `A profile holds up to ${MAX_PHOTOS_PER_PROFILE} photographs. Remove one to add another.`, 409);
  }

  const newId = await withTransaction((tx) => insert(
    tx,
    `INSERT INTO profile_photos (profileId, uploadedByUserId, data, mimeType, byteSize, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [profile.id, req.auth.sub, parsed.dataUrl, parsed.mimeType, parsed.byteSize]
  ));

  return res.status(201).json({
    photos: await galleryForManager(profile.id),
    uploadedId: newId,
    note: 'Uploaded. A moderator looks at it before anyone else can — usually within a day.',
  });
});

// ── hold the gallery back, or open it ──
// body: { photoLocked: boolean, profileId? }
// One switch over the whole gallery, which is what profiles.photoLocked has
// always been. It lives with the photographs rather than among the biodata
// fields because it is a fact about them, and because a ghotok's studio has
// no biodata save to hang it off.
router.patch('/my-gallery', managerOnly, async (req, res) => {
  const profile = await editableProfile(req, res);
  if (!profile) return undefined;
  if (typeof req.body?.photoLocked !== 'boolean') return bad(res, 'photoLocked must be true or false.');

  await withTransaction((tx) => tx.execute(
    'UPDATE profiles SET photoLocked = ? WHERE id = ?',
    [req.body.photoLocked ? 1 : 0, profile.id]
  ));
  return res.json({ photoLocked: req.body.photoLocked });
});

// ── remove one ──
// A real delete, unlike a moderation decision: it is the family's own
// photograph and taking it back down is theirs to do.
router.delete('/my-gallery/:photoId', managerOnly, async (req, res) => {
  const photo = await queryOne('SELECT id, profileId FROM profile_photos WHERE id = ? LIMIT 1', [Number(req.params.photoId)]);
  if (!photo) return bad(res, 'Photograph not found.', 404);

  const profile = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [photo.profileId]);
  if (!managesProfile(req, profile)) return bad(res, 'That photograph is not yours to remove.', 403);

  await withTransaction((tx) => tx.execute('DELETE FROM profile_photos WHERE id = ?', [photo.id]));
  return res.json({ photos: await galleryForManager(profile.id) });
});

// ── another family's gallery ──
// Approved photographs only, and only if the profile is unlocked or this
// viewer has been granted them. A locked one still reports its count.
router.get('/profiles/:id/gallery', managerOnly, async (req, res) => {
  const profile = await queryOne(
    'SELECT id, photoLocked, managedByGhotokId FROM profiles WHERE id = ? LIMIT 1',
    [Number(req.params.id)]
  );
  if (!profile) return bad(res, 'Profile not found.', 404);

  // Their own profile in their own book — show it as its manager, so a ghotok
  // browsing the pool sees the pending ones on the profiles they run.
  const full = await queryOne('SELECT * FROM profiles WHERE id = ? LIMIT 1', [profile.id]);
  if (managesProfile(req, full)) {
    return res.json({ locked: false, granted: true, mine: true, count: 0, photos: await galleryForManager(profile.id) });
  }

  return res.json({ mine: false, ...await galleryForViewer(profile, viewerFor(req)) });
});

// ── the moderation queue ──
router.get('/admin/photos', adminOnly, async (_req, res) => {
  const rows = await query(
    `SELECT ph.id, ph.data, ph.mimeType, ph.byteSize, ph.status, ph.createdAt,
            p.prn, p.fullName, p.district, p.managerType, p.photoLocked,
            g.code AS ghotokCode, gu.fullName AS ghotokName, u.fullName AS uploaderName
       FROM profile_photos ph
       JOIN profiles p ON ph.profileId = p.id
       LEFT JOIN ghotoks g ON p.managedByGhotokId = g.id
       LEFT JOIN users gu ON g.userId = gu.id
       LEFT JOIN users u ON ph.uploadedByUserId = u.id
      WHERE ph.status = 'PENDING'
      ORDER BY ph.createdAt ASC`
  );

  const MANAGED_BY = { GHOTOK: 'matchmaker', GUARDIAN: 'guardian', SELF: 'self-managed' };
  return res.json({
    photos: rows.map((r) => ({
      id: r.id,
      src: r.data,
      name: r.fullName,
      prn: r.prn || '—',
      meta: [
        r.district,
        r.managerType === 'GHOTOK' && r.ghotokName ? `${r.ghotokName} · ${r.ghotokCode}` : MANAGED_BY[r.managerType],
        r.uploaderName ? `uploaded by ${r.uploaderName}` : null,
        relativeTime(r.createdAt),
      ].filter(Boolean).join(' · '),
      // Worth saying on the card: approving a photo on a locked profile does
      // not put it in front of anyone — the family still holds it back.
      photoLocked: Boolean(r.photoLocked),
      sizeLabel: `${Math.max(1, Math.round(r.byteSize / 1024))} KB`,
    })),
  });
});

// body: { decision: 'APPROVE' | 'REJECT', note? }
router.patch('/admin/photos/:id', adminOnly, async (req, res) => {
  const MAP = { APPROVE: 'APPROVED', REJECT: 'REJECTED' };
  const status = MAP[req.body?.decision];
  if (!status) return bad(res, 'decision must be APPROVE or REJECT.');

  const photo = await queryOne('SELECT id FROM profile_photos WHERE id = ? LIMIT 1', [Number(req.params.id)]);
  if (!photo) return bad(res, 'Photograph not found.', 404);

  const note = String(req.body?.note || '').trim().slice(0, 191) || null;
  await withTransaction((tx) => tx.execute(
    'UPDATE profile_photos SET status = ?, reviewNote = ?, reviewedAt = ? WHERE id = ?',
    [status, note, new Date(), photo.id]
  ));
  return res.json({ ok: true, status });
});

export default router;
