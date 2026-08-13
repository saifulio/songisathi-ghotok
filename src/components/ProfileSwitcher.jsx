// Which family member the member pages are about.
//
// A guardian matchmaking for two people needs to say which one before any of
// the pages mean anything, so the choice sits in the app chrome rather than
// inside one page. It renders only when there is a choice to make or a profile
// to add — a candidate, who has exactly one profile and cannot add another,
// never sees this bar.

import { NavLink } from 'react-router-dom';
import { useMyProfiles } from '../context/MyProfilesContext.jsx';
import './ProfileSwitcher.css';

export default function ProfileSwitcher() {
  const { profiles, activeId, setActive, limit, canAdd, loading } = useMyProfiles();

  if (loading || (profiles.length <= 1 && !canAdd)) return null;

  return (
    <div className="ps">
      <div className="ps-inner">
        <span className="ps-label">Managing for</span>

        {profiles.length === 0 && (
          <span className="ps-empty">No profile yet — add the family member you are matchmaking for.</span>
        )}

        <div className="ps-chips">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ps-chip ${p.id === activeId ? 'is-active' : ''}`}
              onClick={() => setActive(p.id)}
            >
              <span className="ps-chip-init">{p.init}</span>
              <span className="ps-chip-text">
                <span className="ps-chip-name">{p.name}</span>
                <span className="ps-chip-meta">{p.prn || p.statusLabel}</span>
              </span>
            </button>
          ))}
        </div>

        {canAdd ? (
          <NavLink to="/my-add-profile" className="ps-add">+ Add a profile</NavLink>
        ) : (
          <span className="ps-full">{limit} of {limit} used</span>
        )}
      </div>
    </div>
  );
}
