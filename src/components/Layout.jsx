import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { NAV_GROUPS } from '../nav.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Layout.css';

const ROLE_LABEL = { GHOTOK: 'Matchmaker', GUARDIAN: 'Guardian', CANDIDATE: 'Member', ADMIN: 'Admin' };

// A nav item is visible when it's public, or the signed-in user's role is
// allowed on it (mirrors ProtectedRoute so we never show a dead link).
function canSee(item, user) {
  if (item.public) return true;
  if (!user) return false;
  if (item.roles && !item.roles.includes(user.role)) return false;
  return true;
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const groups = NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, user)) }))
    .filter((group) => group.items.length > 0);

  const doLogout = () => {
    logout();
    setOpen(false);
    navigate('/signin');
  };

  return (
    <div className="ss-shell">
      <header className="ss-topbar">
        <div className="ss-topbar-inner">
          <NavLink to="/" className="ss-brand" onClick={() => setOpen(false)}>
            <span className="ss-brand-mark">স</span>
            <span className="ss-brand-name">SongiSathi</span>
          </NavLink>

          <button
            className="ss-menu-btn"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <nav className={`ss-nav ${open ? 'is-open' : ''}`}>
            {groups.map((group) => (
              <div className="ss-nav-group" key={group.label}>
                <span className="ss-nav-group-label">{group.label}</span>
                <div className="ss-nav-links">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      className={({ isActive }) => `ss-nav-link ${isActive ? 'is-active' : ''}`}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="ss-auth">
              {user ? (
                <>
                  <div className="ss-user">
                    <span className="ss-user-name">{user.fullName}</span>
                    <span className="ss-user-role">{ROLE_LABEL[user.role] || user.role}{user.code ? ` · ${user.code}` : ''}</span>
                  </div>
                  <button className="ss-auth-btn ghost" onClick={doLogout}>Log out</button>
                </>
              ) : (
                <>
                  <NavLink to="/signin" className="ss-auth-btn ghost" onClick={() => setOpen(false)}>Sign in</NavLink>
                  <NavLink to="/signup" className="ss-auth-btn solid" onClick={() => setOpen(false)}>Sign up</NavLink>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {open && <div className="ss-scrim" onClick={() => setOpen(false)} />}

      <main className="ss-content">{children}</main>
    </div>
  );
}
