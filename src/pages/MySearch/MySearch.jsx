import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Input, Select, Switch, Tag, ProfileCard } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './MySearch.css';

const opts = (a) => a.map((v) => ({ value: v, label: v }));
const DEFAULT_FF = { gender: 'Any', ageMin: 20, ageMax: 40, district: 'Any district', edu: 'Any level', verified: false, screened: false };
const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function MySearch() {
  const { user, token } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(null);
  // Whether this account may act on what it finds. A candidate whose profile a
  // ghotok or guardian manages browses the same pool, but their manager is the
  // one who sends interest — the server is the source of truth (see my-search).
  const [canSendInterest, setCanSendInterest] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [ff, setFf] = useState(DEFAULT_FF);
  const [sent, setSent] = useState({});
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const setFF = (k, v) => setFf((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    api.mySearch(token)
      .then((data) => {
        if (!live) return;
        setResults(data.profiles);
        setCanSendInterest(data.canSendInterest !== false);
        if (data.myGender) setFf((s) => ({ ...s, gender: data.myGender === 'MALE' ? 'FEMALE' : 'MALE' }));
        setSelected((cur) => cur ?? data.profiles.find((r) => !data.myGender || r.gender !== data.myGender)?.id ?? data.profiles[0]?.id ?? null);
      })
      .catch((e) => { if (live) setBlocked(e.message || 'Search is not available for this account.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token]);

  const matches = (r) => {
    if (ff.gender !== 'Any' && r.gender !== ff.gender) return false;
    if (ff.verified && !r.verified) return false;
    if (ff.screened && !r.screened) return false;
    if (ff.district !== 'Any district' && r.dcode !== ff.district) return false;
    if (ff.edu !== 'Any level' && r.eduLevel !== ff.edu) return false;
    if (r.age < ff.ageMin || r.age > ff.ageMax) return false;
    const query = q.trim().toLowerCase();
    if (query && !(`${r.name} ${r.prn} ${r.edu} ${r.district}`.toLowerCase().includes(query))) return false;
    return true;
  };
  const list = results.filter(matches);
  const sel = list.find((r) => r.id === selected) || null;

  const chips = [];
  if (ff.verified) chips.push({ label: 'Verified only', k: 'verified' });
  if (ff.screened) chips.push({ label: 'Screening done', k: 'screened' });
  if (ff.district !== 'Any district') chips.push({ label: ff.district, k: 'district' });
  if (ff.edu !== 'Any level') chips.push({ label: ff.edu, k: 'edu' });
  const removeChip = (k) => setFF(k, k === 'district' ? 'Any district' : k === 'edu' ? 'Any level' : false);

  const rows = sel ? [
    { k: 'Education', v: sel.edu }, { k: 'Profession', v: sel.job }, { k: 'Family', v: sel.family },
    { k: 'Siblings', v: sel.siblings }, { k: 'Religious practice', v: sel.religion }, { k: 'Family is looking for', v: sel.looking },
  ] : [];

  const sendInterest = async () => {
    const id = sel.id;
    try {
      await api.sendInterest(token, id);
      setSent((s) => ({ ...s, [id]: true }));
      say(`Interest sent to ${sel.managedBy}. They decide whether to accept it.`);
    } catch (e) {
      say(e.message || 'Could not send interest.');
    }
  };

  if (blocked) {
    return (
      <div className="ms"><div className="ms-blocked">
        <div className="ms-blocked-t">Search isn't open on this account</div>
        <div className="ms-blocked-b">{blocked}</div>
        <a className="ms-blocked-link" href="/guardian">Go to your proposals</a>
      </div></div>
    );
  }

  return (
    <div className="ms">
      <div className="ms-frame">
        <div className="ms-topbar">
          <div className="ms-topbar-brand"><div className="ms-logo">স</div><span>SongiSathi</span></div>
          <span className="ms-topbar-note">Search & profiles</span>
          <div className="ms-topbar-right"><Avatar initials={initialsOf(user?.fullName)} size={28} /></div>
        </div>

        <div className={`ms-grid ${sel ? 'has-panel' : ''}`}>
          <div className="ms-filters">
            <div>
              <div className="ms-h-bn">অনুসন্ধান</div>
              <div className="ms-h-sub">Search profiles in the trusted network</div>
            </div>
            <Select label="Looking for" value={ff.gender} onChange={(e) => setFF('gender', e.target.value)} options={opts(['Any', 'FEMALE', 'MALE']).map((o) => ({ value: o.value, label: o.value === 'FEMALE' ? 'Bride' : o.value === 'MALE' ? 'Groom' : 'Any' }))} />
            <div>
              <div className="ms-age-label">Age range</div>
              <div className="ms-age-row">
                <span>{ff.ageMin}</span>
                <input type="range" min="18" max="50" value={ff.ageMax} onChange={(e) => setFF('ageMax', Number(e.target.value))} className="ms-range" />
                <span>{ff.ageMax}</span>
              </div>
            </div>
            <Select label="District" value={ff.district} onChange={(e) => setFF('district', e.target.value)} options={opts(['Any district', 'Dhaka', 'Sylhet', 'Chattogram', 'Mymensingh'])} />
            <Select label="Education" value={ff.edu} onChange={(e) => setFF('edu', e.target.value)} options={opts(['Any level', 'Graduate', 'Postgraduate'])} />
            <div className="ms-switches">
              <Switch label="Verified profiles only" checked={ff.verified} onChange={() => setFF('verified', !ff.verified)} />
              <Switch label="Screening completed" checked={ff.screened} onChange={() => setFF('screened', !ff.screened)} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFf(DEFAULT_FF); setQ(''); }}>Reset filters</Button>
          </div>

          <div className="ms-results">
            <div className="ms-results-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input placeholder="নাম, PRN, প্রতিষ্ঠান খুঁজুন · Search name, PRN, institution" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="ms-results-meta">
              <span>{list.length} profiles in the network pool</span>
              <div className="ms-chips">{chips.map((c) => (<Tag key={c.k} onRemove={() => removeChip(c.k)}>{c.label}</Tag>))}</div>
            </div>
            <div className="ms-cards">
              {list.map((r) => (
                <div key={r.id} style={{ borderRadius: 14, outline: selected === r.id ? '2px solid var(--brand-primary)' : '2px solid transparent', outlineOffset: 2 }}>
                  <ProfileCard profileId={r.prn} name={r.name} age={r.age} height={r.height} education={r.edu} district={r.district} managedBy={r.managedBy.split(' ')[0]} verified={r.verified} photoLocked onClick={() => setSelected(r.id)} />
                </div>
              ))}
              {loading && <div className="ms-empty"><div className="ms-empty-t">Loading profiles…</div></div>}
              {!loading && list.length === 0 && (
                <div className="ms-empty">
                  <div className="ms-empty-t">No profiles match these filters</div>
                  <div className="ms-empty-b">Widen the age range or clear a filter.</div>
                  <Button variant="outline" size="sm" onClick={() => { setFf(DEFAULT_FF); setQ(''); }}>Clear filters</Button>
                </div>
              )}
            </div>
          </div>

          {sel && (
            <div className="ms-panel">
              <div className="ms-panel-head">
                <span className="ms-panel-label">Profile detail</span>
                <span className="ms-panel-close" onClick={() => setSelected(null)}>Close</span>
              </div>
              <div className="ms-panel-body">
                <div className="ms-panel-hero">
                  <div className="ms-panel-photo">
                    <div className="ms-panel-photo-bg" />
                    <div className="ms-panel-photo-lock">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                      <span>Photo hidden until accepted</span>
                    </div>
                  </div>
                  <div className="ms-panel-hero-info">
                    <div className="ms-panel-name-row">
                      <span className="ms-panel-name">{sel.name}</span>
                      {sel.verified && <Badge tone="gold">Verified</Badge>}
                    </div>
                    <div className="ms-panel-prn">{sel.prn}</div>
                    <div className="ms-panel-basics">{sel.age} years · {sel.height}<br />{sel.district}</div>
                    <div className="ms-panel-badges">
                      <Badge tone={sel.screened ? 'success' : 'neutral'}>{sel.screened ? 'Screening complete' : 'Screening pending'}</Badge>
                    </div>
                  </div>
                </div>

                <div className="ms-block">
                  <div className="ms-block-label">Biodata</div>
                  <div className="ms-rows">{rows.map((rw) => (<div key={rw.k} className="ms-row"><span className="ms-row-k">{rw.k}</span><span className="ms-row-v">{rw.v}</span></div>))}</div>
                </div>

                <div className="ms-block">
                  <div className="ms-mgr">
                    <Avatar initials={sel.managedBy.slice(0, 2).toUpperCase()} size={30} />
                    <div><div className="ms-mgr-name">{sel.managedBy}</div><div className="ms-mgr-meta">{sel.mgrMeta}</div></div>
                  </div>
                  <div className="ms-mgr-note">Every message and every contact detail passes through this manager.</div>
                </div>
              </div>

              <div className="ms-panel-actions">
                {!canSendInterest
                  ? <div className="ms-interest-sent">Your manager sends interest on your behalf — show them this profile.</div>
                  : !sent[sel.id]
                    ? <Button variant="primary" style={{ width: '100%' }} onClick={sendInterest}>আগ্রহ পাঠান · Send interest</Button>
                    : <div className="ms-interest-sent">Interest sent — awaiting their reply</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (<div className="ms-toast"><span className="ms-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
