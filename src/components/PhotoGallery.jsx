// The photo gallery, from both chairs.
//
//   GalleryManager — what the manager of a profile sees: every photograph
//     they hold including the ones the moderation queue has not passed yet,
//     an upload tile, and the one switch that holds the whole gallery back.
//   PhotoSlideshow — what another family sees: the approved photographs, or
//     the locked panel with a count, which is what makes asking worthwhile.
//
// A ghotok manages many profiles and names the one they mean; a family's
// comes from the profile switcher, so profileId is optional there — the same
// convention as every other member call (see src/lib/api.js).

import { useState, useRef, useEffect, useCallback } from 'react';
import { Switch } from './ui/index.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fileToPhoto, ACCEPTED_TYPES } from '../lib/images.js';
import './PhotoGallery.css';

const LOCK_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
    <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
  </svg>
);

const TILE_TONE = { APPROVED: 'ok', REJECTED: 'no', PENDING: '' };

export function GalleryManager({ profileId, canEdit = true, onError }) {
  const { token } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [locked, setLocked] = useState(true);
  const [limit, setLimit] = useState(8);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);
  const say = useCallback((msg) => onError?.(msg), [onError]);

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.myGallery(token, profileId)
      .then((d) => {
        if (!live) return;
        setPhotos(d.photos || []);
        setLocked(Boolean(d.photoLocked));
        setLimit(d.limit || 8);
      })
      .catch((e) => say(e.message || 'Could not load your photographs.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, profileId, say]);

  // A rejected photograph does not count against the limit — it is not in
  // anyone's gallery, it is just still on screen so it can be replaced.
  const held = photos.filter((p) => p.status !== 'REJECTED').length;
  const full = held >= limit;

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    try {
      const image = await fileToPhoto(file);
      const d = await api.uploadPhoto(token, image, profileId);
      setPhotos(d.photos || []);
      say(d.note);
    } catch (e) {
      say(e.message || 'Could not upload that photograph.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await api.deletePhoto(token, id, profileId);
      setPhotos(d.photos || []);
    } catch (e) {
      say(e.message || 'Could not remove that photograph.');
    } finally {
      setBusy(false);
    }
  };

  const toggleLock = async () => {
    const next = !locked;
    setLocked(next);
    try {
      await api.setGalleryLock(token, next, profileId);
    } catch (e) {
      setLocked(!next);
      say(e.message || 'Could not change that setting.');
    }
  };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-label">Photographs</span>
        {!loading && <span className="pg-count">{held} of {limit}</span>}
      </div>

      {loading ? (
        <div className="pg-empty">Loading photographs…</div>
      ) : (
        <>
          <div className="pg-grid">
            {photos.map((p) => (
              <div key={p.id} className={`pg-tile is-${p.status.toLowerCase()}`}>
                <img src={p.src} alt="" />
                {canEdit && (
                  <button className="pg-tile-remove" onClick={() => remove(p.id)} aria-label="Remove this photograph">×</button>
                )}
                <span className={`pg-tile-status ${TILE_TONE[p.status]}`}>
                  {p.status === 'APPROVED' && locked ? LOCK_ICON : null}
                  {p.statusLabel}
                </span>
              </div>
            ))}
            {canEdit && (
              <button className="pg-add" onClick={() => fileRef.current?.click()} disabled={busy || full}>
                <span className="pg-add-mark">+</span>
                <span>{full ? 'Gallery full' : busy ? 'Uploading…' : 'Add a photograph'}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED_TYPES} onChange={pick} style={{ display: 'none' }} />

          {photos.some((p) => p.status === 'REJECTED' && p.reviewNote) && (
            <div className="pg-review">
              {photos.filter((p) => p.status === 'REJECTED' && p.reviewNote).map((p) => (
                <div key={p.id}>Not approved — {p.reviewNote}</div>
              ))}
            </div>
          )}

          {photos.length === 0 && canEdit && (
            <div className="pg-empty">
              No photographs yet. A moderator looks at each one before anyone outside this page can see it.
            </div>
          )}

          {canEdit && (
            <div className="pg-lock-row">
              <div style={{ flex: 1 }}>
                <Switch label="Show only on request" checked={locked} onChange={toggleLock} />
                <div className="pg-lock-copy">
                  {locked
                    ? 'Held back. Another family sees that photographs exist and has to ask; you decide each time.'
                    : 'Open to the trusted network. Approved photographs show to anyone who can see this profile.'}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// The viewer's side. `gallery` is what GET /profiles/:id/gallery returned —
// the caller loads it, because the pages that show this already fetch the
// profile it belongs to.
export function PhotoSlideshow({ gallery, locked: lockedProp, onRequest }) {
  const [at, setAt] = useState(0);
  const photos = gallery?.photos || [];
  const count = gallery?.count ?? photos.length;
  const locked = lockedProp ?? gallery?.locked;

  useEffect(() => { setAt(0); }, [gallery]);

  if (locked || !photos.length) {
    return (
      <div className="pg-locked">
        <div className="pg-locked-bg" />
        <div className="pg-locked-veil">
          {LOCK_ICON}
          <span>
            {count > 0
              ? `${count} photograph${count === 1 ? '' : 's'} · released only on request`
              : 'No photograph on this profile yet'}
          </span>
          {onRequest && count > 0 && <span>Ask their manager to release them for this proposal.</span>}
        </div>
      </div>
    );
  }

  const step = (delta) => setAt((i) => (i + delta + photos.length) % photos.length);

  return (
    <div className="pg-show">
      <img src={photos[at].src} alt="" />
      {photos.length > 1 && (
        <>
          <button className="pg-show-nav prev" onClick={() => step(-1)} aria-label="Previous photograph">‹</button>
          <button className="pg-show-nav next" onClick={() => step(1)} aria-label="Next photograph">›</button>
          <div className="pg-show-dots">
            {photos.map((p, i) => (
              <button
                key={p.id}
                className={`pg-show-dot ${i === at ? 'is-on' : ''}`}
                onClick={() => setAt(i)}
                aria-label={`Photograph ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
