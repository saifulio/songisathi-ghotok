import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMyProfiles } from '../../context/MyProfilesContext.jsx';
import { api } from '../../lib/api.js';
import './MyMatches.css';

const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function MyMatches() {
  const { user, token } = useAuth();
  // Matches are scored against one profile — the one the switcher is on.
  const { activeId } = useMyProfiles();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);
  // A managed candidate reads the same scoring but can't act on it — their
  // ghotok or guardian expresses interest (see my-matches / POST /api/interests).
  const [canSendInterest, setCanSendInterest] = useState(true);
  const [open, setOpen] = useState(null);
  const [decision, setDecision] = useState({});
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.myMatches(token, activeId)
      .then((data) => {
        if (!live) return;
        setMatches(data.matches);
        setCanSendInterest(data.canSendInterest !== false);
        setOpen((cur) => cur ?? data.matches[0]?.profileId ?? null);
      })
      .catch((e) => { if (live) setBlocked(e.message || 'Matching is not available for this account.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, activeId]);

  const express = async (m) => {
    try {
      await api.sendInterest(token, m.profileId, undefined, activeId);
      setDecision((d) => ({ ...d, [m.profileId]: 'sent' }));
      say(`Interest sent to ${m.name}. They decide whether to accept it.`);
    } catch (e) {
      say(e.message || 'Could not send interest.');
    }
  };
  const dismiss = (m) => {
    setDecision((d) => ({ ...d, [m.profileId]: 'dismissed' }));
    say('Dismissed. This pair will not be highlighted again this session.');
  };

  if (blocked) {
    return (
      <div className="mm"><div className="mm-blocked">
        <div className="mm-blocked-t">Matching isn't open on this account</div>
        <div className="mm-blocked-b">{blocked}</div>
        <a className="mm-blocked-link" href="/guardian">Go to your proposals</a>
      </div></div>
    );
  }

  const visible = matches.filter((m) => decision[m.profileId] !== 'dismissed');

  return (
    <div className="mm">
      <div className="mm-frame">
        <div className="mm-topbar">
          <div className="mm-topbar-brand"><div className="mm-logo">স</div><span>SongiSathi</span></div>
          <span className="mm-topbar-note">AI matching</span>
          <div className="mm-topbar-right"><Avatar initials={initialsOf(user?.fullName)} size={28} /></div>
        </div>

        <div className="mm-body">
          <div>
            <div className="mm-h-bn">সম্ভাব্য মিল</div>
            <div className="mm-h-sub">Scored against your biodata — same fields visible in your profile, nothing hidden or learned about you beyond that.</div>
          </div>

          <div className="mm-list">
            {loading && <div className="mm-pair">Loading matches…</div>}
            {!loading && visible.length === 0 && <div className="mm-pair">No matches found in the network pool right now.</div>}
            {visible.map((m) => {
              const isOpen = open === m.profileId;
              const st = decision[m.profileId];
              return (
                <div key={m.profileId} className="mm-pair">
                  <div className="mm-pair-row">
                    <div className="mm-pair-person">
                      <div className="mm-pair-name">{m.name}{m.verified && <Badge tone="gold" style={{ marginLeft: 8 }}>Verified</Badge>}</div>
                      <div className="mm-pair-meta">{m.age ?? '—'} · {m.edu || '—'} · {m.city || '—'}</div>
                    </div>
                    <div className="mm-pair-score">
                      <span className="mm-pair-score-num">{m.score}%</span>
                      <div className="mm-pair-bar"><div style={{ width: `${m.score}%` }} /></div>
                    </div>
                    <span className="mm-pair-toggle" onClick={() => setOpen(isOpen ? null : m.profileId)}>{isOpen ? 'Hide working' : 'Show working'}</span>
                  </div>

                  {isOpen && (
                    <div className="mm-pair-detail">
                      <div className="mm-factors">
                        {m.factors.map((f) => (
                          <div key={f.label} className="mm-factor">
                            <div className="mm-factor-top"><span>{f.label}</span><span className="mm-factor-pct">{f.pct}%</span></div>
                            <div className="mm-factor-bar"><div style={{ width: `${f.pct}%` }} /></div>
                            <div className="mm-factor-note">{f.note}</div>
                          </div>
                        ))}
                      </div>
                      {!st ? (
                        <div className="mm-pair-actions">
                          {canSendInterest
                            ? <Button variant="primary" size="sm" onClick={() => express(m)}>Express interest</Button>
                            : <span className="mm-pair-res">Your manager expresses interest on your behalf — show them this match.</span>}
                          <Button variant="ghost" size="sm" onClick={() => dismiss(m)}>Dismiss</Button>
                        </div>
                      ) : (
                        <span className="mm-pair-res">{st === 'sent' ? 'Interest sent — awaiting their reply' : 'Dismissed'}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && (<div className="mm-toast"><span className="mm-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
