// One profile, read in full.
//
// The search pages show a side panel with the six lines that decide whether a
// family reads further; this is where they read further. Everything the
// profile holds is on this page, in the order a biodata is normally read:
// who they are, what they studied, what they do, the household they come
// from, how they practise, and what the family is looking for. The
// photographs open full-screen from the portrait.
//
// It serves both chairs — a ghotok reading their own book or the pool, and a
// family reading the pool — because GET /profiles/:id/detail applies each
// side's own visibility rule (see server/routes/profiles.js). What is not
// here is what is never handed over by a read: contact details, and the
// sealed screening answers. The page says so rather than leaving a gap.

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Avatar, Badge, Button } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { PhotoSlideshow } from '../../components/PhotoGallery.jsx';
import './ProfileDetails.css';

const VERIFIED_MARK = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.6l2.3 1.7 2.8-.3 1.1 2.6 2.4 1.5-.6 2.8.9 2.7-2.2 1.8-.8 2.7-2.9.2L12 21.4l-2.9-1.8-2.9-.2-.8-2.7L3.2 15l.9-2.7-.6-2.8L5.9 8 7 5.4l2.8.3z" fill="var(--gold-600)" />
    <path d="M9 12.2l2.1 2.1 4-4.2" stroke="#FDFBF6" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LOCK_MARK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
    <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" />
  </svg>
);

// The sections, as fields of the profile object. A field with nothing in it is
// dropped rather than shown as a dash — an empty biodata section says more
// about how far the profile has been filled in than a column of em-dashes.
const SECTIONS = [
  {
    label: 'Basics',
    fields: [
      ['Age', 'age', (v) => `${v} years`],
      ['Height', 'height'],
      ['Marital status', 'maritalStatus'],
      ['Looking for', 'genderLabel', (v, p) => `${p.name.split(' ')[0]} is listed as a ${v.toLowerCase()}`],
      ['District', 'district'],
      ['Area', 'area'],
    ],
  },
  {
    label: 'Education',
    fields: [
      ['Highest degree', 'degree'],
      ['Institution', 'institution'],
      ['Undergraduate', 'undergraduate'],
      ['Level', 'eduLevel'],
    ],
  },
  {
    label: 'Profession',
    fields: [
      ['Profession', 'profession'],
      ['Organisation', 'organisation'],
    ],
  },
  {
    label: 'Family',
    fields: [
      ['Family type', 'familyType'],
      ['Father', 'fatherInfo'],
      ['Mother', 'motherInfo'],
      ['Siblings', 'siblings'],
      ['Family income', 'familyIncome'],
    ],
  },
  {
    label: 'Faith & practice',
    fields: [
      ['Religion', 'religion'],
      ['Religious practice', 'religiousPractice'],
    ],
  },
];

export default function ProfileDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    setError(null);
    api.profileFull(token, id)
      .then((d) => { if (live) setProfile(d.profile); })
      .catch((e) => { if (live) setError(e.message || 'That profile could not be opened.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, id]);

  // The photographs come from the gallery endpoint, which decides on its own
  // whether this reader may see them — a locked gallery still reports how
  // many exist, which is what the slideshow renders in place of a face.
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    api.profileGallery(token, id)
      .then((d) => { if (live) setGallery(d); })
      .catch(() => { if (live) setGallery(null); });
    return () => { live = false; };
  }, [token, id]);

  if (loading) return <div className="pd"><div className="pd-frame pd-state">Loading profile…</div></div>;

  if (error || !profile) {
    return (
      <div className="pd">
        <div className="pd-frame pd-state">
          <div className="pd-state-t">This profile isn’t open to you</div>
          <div className="pd-state-b">{error || 'It may have been withdrawn from the network pool, or it was never shared outside its own manager’s book.'}</div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  const looking = profile.looking || [];

  return (
    <div className="pd">
      <div className="pd-frame">
        <div className="pd-crumbs">
          <button className="pd-back" onClick={() => navigate(-1)}>← Back</button>
          <span className="pd-crumb-sep">·</span>
          <span className="pd-crumb">{profile.mine ? 'Your profile' : 'Trusted network pool'}</span>
        </div>

        <div className="pd-hero">
          <div className="pd-hero-photo">
            <PhotoSlideshow gallery={gallery} expandable />
            {gallery && !gallery.locked && gallery.photos?.length > 1 && (
              <div className="pd-hero-photo-note">Click a photograph to see all {gallery.photos.length}</div>
            )}
          </div>

          <div className="pd-hero-info">
            <div className="pd-name-row">
              <h1 className="pd-name">{profile.name}</h1>
              {profile.verified && VERIFIED_MARK}
            </div>
            <div className="pd-prn">{profile.prn || 'Not yet published — no PRN issued'}</div>
            <div className="pd-headline">
              {[profile.age ? `${profile.age} years` : null, profile.height, profile.location].filter(Boolean).join(' · ')}
            </div>
            <div className="pd-headline-sub">
              {[profile.profession, profile.degree].filter(Boolean).join(' · ') || 'Biodata still being filled in'}
            </div>
            <div className="pd-badges">
              <Badge tone={profile.verified ? 'gold' : 'neutral'}>{profile.verified ? 'Verified' : 'Verification pending'}</Badge>
              <Badge tone={profile.screened ? 'success' : 'neutral'}>{profile.screened ? 'Screening complete' : 'Screening pending'}</Badge>
              <Badge tone="neutral">{profile.statusLabel}</Badge>
              {profile.mine && <Badge tone="neutral">Yours to manage</Badge>}
            </div>
            <div className="pd-meta-row">
              <span>Biodata {profile.completeness}% complete</span>
              {profile.updatedDays !== null && (
                <span>Updated {profile.updatedDays === 0 ? 'today' : `${profile.updatedDays} day${profile.updatedDays === 1 ? '' : 's'} ago`}</span>
              )}
            </div>
            {profile.mine && (
              <div className="pd-hero-actions">
                {/* Each side has its own studio; a ghotok's takes the profile
                    id, a family's follows the profile switcher. */}
                <Link className="pd-edit-link" to={user?.role === 'GHOTOK' ? '/biodata-studio' : '/my-biodata'}>
                  Edit in the biodata studio →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="pd-body">
          {SECTIONS.map((section) => {
            const rows = section.fields
              .map(([label, key, format]) => {
                const raw = profile[key];
                if (raw === null || raw === undefined || raw === '') return null;
                return { label, value: format ? format(raw, profile) : raw };
              })
              .filter(Boolean);
            if (!rows.length) return null;
            return (
              <section className="pd-section" key={section.label}>
                <h2 className="pd-section-label">{section.label}</h2>
                <div className="pd-rows">
                  {rows.map((r) => (
                    <div className="pd-row" key={r.label}>
                      <span className="pd-row-k">{r.label}</span>
                      <span className="pd-row-v">{r.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="pd-section">
            <h2 className="pd-section-label">What this family is looking for</h2>
            {looking.length ? (
              <ul className="pd-prefs">
                {looking.map((label) => <li key={label} className="pd-pref">{label}</li>)}
              </ul>
            ) : (
              <div className="pd-note">This family has not written down what they are looking for. Their manager can tell you more.</div>
            )}
          </section>

          <section className="pd-section">
            <h2 className="pd-section-label">Screening</h2>
            <div className="pd-note">
              {profile.screened
                ? `${profile.sealedCount} screening answer${profile.sealedCount === 1 ? '' : 's'} are held sealed on this profile. They are not shown to anyone browsing — a manager opens them only once both sides are in discussion.`
                : 'The private screening questions have not been answered on this profile yet.'}
            </div>
          </section>

          <section className="pd-section">
            <h2 className="pd-section-label">Managed by</h2>
            <div className="pd-mgr">
              <Avatar initials={profile.manager.name.slice(0, 2).toUpperCase()} size={34} />
              <div>
                <div className="pd-mgr-name">{profile.manager.name}</div>
                <div className="pd-mgr-meta">{profile.manager.meta}</div>
              </div>
            </div>
            <div className="pd-note">
              Every message and every contact detail passes through this manager. Nothing reaches the candidate directly.
            </div>
          </section>

          <section className="pd-section pd-sealed">
            <div className="pd-sealed-head">{LOCK_MARK}<span>Contact details are hidden</span></div>
            <div className="pd-note">
              Phone numbers and addresses stay sealed until interest is accepted and both managers release them.
              No exceptions, and no paid unlock.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
