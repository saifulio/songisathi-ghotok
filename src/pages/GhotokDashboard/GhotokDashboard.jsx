import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Avatar, Switch, Tabs } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './GhotokDashboard.css';

// Status label → Badge tone.
const ST = {
  Active: 'success',
  'In discussion': 'pending',
  'Match in progress': 'warning',
  Married: 'gold',
  'Auto-archived': 'neutral',
  Draft: 'neutral',
  Paused: 'warning',
};

const NAV = [
  { bn: 'ড্যাশবোর্ড', en: 'Dashboard', to: '/dashboard' },
  { bn: 'প্রোফাইল', en: 'Profiles', to: '/search' },
  { bn: 'অনুসন্ধান', en: 'Search', to: '/search' },
  { bn: 'এআই ম্যাচিং', en: 'AI matching', to: '/ai-matching' },
  { bn: 'বায়োডাটা', en: 'Biodata studio', to: '/biodata-studio' },
  { bn: 'কমিশন', en: 'Commission', to: '/commission' },
  { bn: 'নেটওয়ার্ক পুল', en: 'Network pool', to: '/search' },
];

const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const cap = (x) => (x ? x[0] + x.slice(1).toLowerCase() : x);

export default function GhotokDashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [langBn, setLangBn] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sugState, setSugState] = useState({});
  const [whyOpen, setWhyOpen] = useState(null);
  const [attested, setAttested] = useState({});
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Load the ghotok's book, this week's suggestions, and the headline stats.
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    Promise.all([api.profiles(token), api.matchSuggestions(token), api.dashboardStats(token)])
      .then(([p, s, st]) => {
        if (!live) return;
        setProfiles(p.profiles);
        setSuggestions(s.suggestions);
        setStats(st.stats);
      })
      .catch((e) => say(e.message || 'Could not load your workspace.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, say]);

  const displayName = user?.fullName || 'Ghotok';
  const code = user?.code || stats?.code || '';
  const tier = user?.tier || stats?.tier || '';
  const referralCode = user?.referralCode || stats?.referralCode || '';
  const initials = initialsOf(displayName);

  const needsRefresh = (p) => p.days >= 75 && p.status !== 'Auto-archived' && p.status !== 'Married';

  const filtered =
    filter === 'discussion' ? profiles.filter((p) => p.status === 'In discussion')
      : filter === 'refresh' ? profiles.filter(needsRefresh)
        : filter === 'married' ? profiles.filter((p) => p.status === 'Married')
          : profiles;
  const shown = filtered.slice(0, 6);

  const filterTabs = [
    { value: 'all', label: 'All', count: profiles.length },
    { value: 'discussion', label: 'In discussion', count: profiles.filter((p) => p.status === 'In discussion').length },
    { value: 'refresh', label: 'Needs refresh', count: profiles.filter(needsRefresh).length },
    { value: 'married', label: 'Married', count: profiles.filter((p) => p.status === 'Married').length },
  ];

  const attestQueue = profiles
    .filter((p) => needsRefresh(p) && !attested[p.id])
    .slice(0, 2)
    .map((p) => ({ id: p.id, name: p.name, prn: p.prn, days: p.days, left: Math.max(0, 90 - p.days) }));

  const meter = stats && stats.profileLimit ? Math.round((stats.activeProfiles / stats.profileLimit) * 100) : 0;
  const statCards = [
    { bn: 'সক্রিয় প্রোফাইল', en: 'Active profiles', val: stats ? String(stats.activeProfiles) : '—', sub: stats ? `/ ${stats.profileLimit}` : '', meter, foot: stats ? `${Math.max(0, stats.profileLimit - stats.activeProfiles)} slots left on ${cap(stats.tier)}` : '', footColor: '#8C6318' },
    { bn: 'এ সপ্তাহের প্রস্তাব', en: 'Matches suggested', val: stats ? String(stats.matchesSuggested) : '—', foot: stats ? `${stats.matchesSuggested} awaiting your review` : '', footColor: '#3D6B44' },
    { bn: 'চলমান পরিচয়', en: 'Introductions in progress', val: stats ? String(stats.introductionsInProgress) : '—', foot: 'In discussion or match in progress', footColor: '#BD572F' },
    { bn: 'সম্পন্ন বিবাহ', en: 'Marriages closed · lifetime', val: stats ? String(stats.marriagesClosed) : '—', dark: true, foot: 'Record a marriage' },
    { bn: 'কমিশন প্রাপ্ত', en: 'Commission received', val: stats ? `৳${stats.commissionReceived.toLocaleString('en-IN')}` : '—', foot: stats ? `${stats.paymentsReceived} of ${stats.paymentsTotal} payments received` : '', footColor: '#3D6B44' },
  ];

  const navCountFor = (en) =>
    en === 'Profiles' ? (profiles.length ? String(profiles.length) : '')
      : en === 'AI matching' ? (suggestions.length ? String(suggestions.length) : '')
        : en === 'Commission' && stats ? (stats.paymentsTotal - stats.paymentsReceived > 0 ? String(stats.paymentsTotal - stats.paymentsReceived) : '')
          : '';

  const updLabel = (p) =>
    attested[p.id] ? 'Confirmed today'
      : p.status === 'Married' ? `Closed ${p.days}d ago`
        : p.status === 'Auto-archived' ? 'Archived at 90 days'
          : `Updated ${p.days} day${p.days === 1 ? '' : 's'} ago`;

  // ── actions (optimistic, reverting on error) ──
  const togglePool = async (p) => {
    const next = !p.pool;
    setProfiles((list) => list.map((x) => (x.id === p.id ? { ...x, pool: next } : x)));
    try {
      await api.updateProfile(token, p.id, { inNetworkPool: next });
      say(next
        ? `${p.name} is now visible to trusted-network matching. Contact still routes through you.`
        : `${p.name} removed from the trusted network pool. Only you can see this profile now.`);
    } catch (e) {
      setProfiles((list) => list.map((x) => (x.id === p.id ? { ...x, pool: !next } : x)));
      say(e.message || 'Could not update the pool setting.');
    }
  };

  const attest = async (p) => {
    setAttested((s) => ({ ...s, [p.id]: true }));
    setProfiles((list) => list.map((x) => (x.id === p.id ? { ...x, days: 0, status: x.status === 'Auto-archived' ? 'Active' : x.status } : x)));
    try {
      await api.updateProfile(token, p.id, { attest: true });
      say(`${p.name} confirmed as active. The 90-day archive clock has reset.`);
    } catch (e) {
      setAttested((s) => { const n = { ...s }; delete n[p.id]; return n; });
      say(e.message || 'Could not confirm the profile.');
    }
  };

  const actSuggestion = async (s, status) => {
    setSugState((p) => ({ ...p, [s.id]: status === 'ACCEPTED' ? 'accepted' : 'dismissed' }));
    setWhyOpen(null);
    try {
      await api.updateSuggestion(token, s.id, { status });
      say(status === 'ACCEPTED'
        ? `Introduction sent to both guardians on WhatsApp. ${s.a?.name} ↔ ${s.b?.name} is now in progress.`
        : 'Dismissed. The system will not suggest this pair again this quarter.');
    } catch (e) {
      setSugState((p) => { const n = { ...p }; delete n[s.id]; return n; });
      say(e.message || 'Could not update the suggestion.');
    }
  };

  return (
    <div className="gd">
      <div className="gd-frame">
        {/* --- app nav --- */}
        <aside className="gd-side">
          <div className="gd-side-brand">
            <div className="gd-logo">স</div>
            <div>
              <div className="gd-logo-name">SongiSathi</div>
              <div className="gd-logo-sub">GHOTOK WORKSPACE</div>
            </div>
          </div>

          <div className="gd-tier">
            <div className="gd-tier-top">
              <Badge tone="gold">{tier || '—'}</Badge>
              <span className="gd-tier-verified">Verified</span>
            </div>
            <div className="gd-tier-count">
              <span className="gd-tier-num">{stats ? stats.activeProfiles : '—'}<span>/{stats ? stats.profileLimit : '—'}</span></span>
              <span className="gd-tier-label">সক্রিয় প্রোফাইল</span>
            </div>
            <div className="gd-tier-bar"><div style={{ width: `${meter}%` }} /></div>
            <div className="gd-tier-upgrade" onClick={() => say('Upgrade to the 150-profile plan — ৳5,000/mo, or ৳4,000 on annual billing.')}>
              {meter}% used · Upgrade for 150 →
            </div>
          </div>

          <nav className="gd-nav">
            {NAV.map((n, i) => {
              const count = navCountFor(n.en);
              return (
                <div key={n.en + i} className={`gd-nav-item ${i === 0 ? 'is-active' : ''}`} onClick={() => n.to && navigate(n.to)}>
                  <span className="gd-nav-dot" />
                  <span className="gd-nav-labels">
                    <span className="gd-nav-bn">{n.bn}</span>
                    <span className="gd-nav-en">{n.en}</span>
                  </span>
                  {count && <span className="gd-nav-count">{count}</span>}
                </div>
              );
            })}
          </nav>

          <div className="gd-referral">
            <div className="gd-referral-title">সহকর্মী ঘটককে আমন্ত্রণ করুন</div>
            <div className="gd-referral-body">Invite a fellow ghotok — you both get one month free.</div>
            <div className="gd-referral-code" onClick={() => say('Invite link copied. When your colleague activates, you both get one month free.')}>
              <span>{referralCode || '—'}</span>
              <span className="gd-referral-copy">Copy</span>
            </div>
          </div>
        </aside>

        {/* --- main --- */}
        <div className="gd-main">
          <header className="gd-header">
            <div className="gd-header-greet">
              <div className="gd-header-bn">শুভ সকাল, {displayName}</div>
              <div className="gd-header-en">Good morning · {cap(tier)} plan{code ? ` · ${code}` : ''}</div>
            </div>
            <div className="gd-search" onClick={() => navigate('/search')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#AA9683" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <span>প্রোফাইল খুঁজুন · Search profiles</span>
            </div>
            <button className="gd-lang" onClick={() => { setLangBn((v) => !v); say(langBn ? 'Interface language set to English. Bangla stays as the caption layer.' : 'বাংলা ইন্টারফেস চালু হলো। ইংরেজি ক্যাপশন হিসেবে থাকবে।'); }}>
              <span className={langBn ? 'on' : ''} style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>বাংলা</span>
              <span className={!langBn ? 'on' : ''}>EN</span>
            </button>
            <div className="gd-user">
              <Avatar initials={initials} size={32} />
              <div>
                <div className="gd-user-name">{displayName}</div>
                <div className="gd-user-id">{code}</div>
              </div>
            </div>
          </header>

          <div className="gd-body">
            {/* stats */}
            <div className="gd-stats">
              {statCards.map((s, i) => (
                <div key={i} className={`gd-stat ${s.dark ? 'dark' : ''}`}>
                  <div className="gd-stat-bn">{s.bn}</div>
                  <div className="gd-stat-en">{s.en}</div>
                  <div className="gd-stat-val">
                    {s.val}
                    {s.sub && <span className="gd-stat-sub">{s.sub}</span>}
                    {s.dark && (
                      <svg width="12" height="12" viewBox="0 0 24 24" style={{ marginLeft: 6 }}><path d="M12 2l2.6 6.8L22 10l-5.4 4.4L18 22l-6-3.8L6 22l1.4-7.6L2 10l7.4-1.2z" fill="#DBB863" /></svg>
                    )}
                  </div>
                  {s.meter != null && <div className="gd-stat-meter"><div style={{ width: `${s.meter}%` }} /></div>}
                  {s.dark ? (
                    <button className="gd-stat-record" onClick={() => navigate('/commission')}>Record a marriage</button>
                  ) : (
                    <div className="gd-stat-foot" style={{ color: s.footColor }}>{s.foot}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="gd-cols">
              {/* AI suggestions */}
              <section className="gd-panel">
                <div className="gd-panel-head">
                  <div className="gd-panel-title-wrap">
                    <div className="gd-panel-bn">এই সপ্তাহের ম্যাচ প্রস্তাব</div>
                    <div className="gd-panel-en">AI match suggestions · {suggestions.length} open{loading ? ' · loading…' : ''}</div>
                  </div>
                  <span className="gd-screen-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2F5233" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
                    Private screening applied
                  </span>
                </div>

                <div className="gd-sugs">
                  {!loading && suggestions.length === 0 && (
                    <div className="gd-sug" style={{ padding: 20, color: 'var(--text-secondary)' }}>No open suggestions this week.</div>
                  )}
                  {suggestions.map((s) => {
                    const st = sugState[s.id];
                    const a = s.a, b = s.b;
                    const isWhy = whyOpen === s.id;
                    return (
                      <div key={s.id} className={`gd-sug ${st === 'accepted' ? 'accepted' : ''}`}>
                        <div className="gd-sug-row">
                          <div className="gd-sug-pair">
                            {[a, b].map((person, idx) => (
                              <div key={idx}>
                                {idx === 1 && (
                                  <div className="gd-sug-connect">
                                    <span className="gd-sug-connect-icon">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#BD572F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></svg>
                                    </span>
                                    <span className="gd-sug-line" />
                                  </div>
                                )}
                                <div className="gd-sug-person">
                                  <div className="gd-sug-thumb">{person?.init}</div>
                                  <div className="gd-sug-person-info">
                                    <div className="gd-sug-name">{person?.name}</div>
                                    <div className="gd-sug-meta">{person?.age} · {person?.job} · {person?.city}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="gd-sug-score">
                            <div className="gd-sug-score-num">{s.score}%</div>
                            <div className="gd-sug-score-label">সঙ্গতি · compatibility</div>
                          </div>
                          <div className="gd-sug-actions">
                            {!st ? (
                              <>
                                <Button variant="outline" size="sm" onClick={() => setWhyOpen(isWhy ? null : s.id)}>Why?</Button>
                                <Button variant="ghost" size="sm" onClick={() => actSuggestion(s, 'DISMISSED')}>Dismiss</Button>
                                <Button variant="primary" size="sm" onClick={() => actSuggestion(s, 'ACCEPTED')}>Introduce · পরিচয় করান</Button>
                              </>
                            ) : (
                              <span className={`gd-sug-resolved ${st}`}>{st === 'accepted' ? 'Introduction sent' : 'Dismissed'}</span>
                            )}
                          </div>
                        </div>

                        {isWhy && (
                          <div className="gd-why">
                            <div className="gd-why-head">
                              <span>Why this pair — visible factors only</span>
                              <span className="gd-why-close" onClick={() => setWhyOpen(null)}>Close</span>
                            </div>
                            <div className="gd-why-grid">
                              {s.factors.map((f) => (
                                <div key={f.label} className="gd-factor">
                                  <div className="gd-factor-top"><span>{f.label}</span><span className="gd-factor-pct">{f.pct}%</span></div>
                                  <div className="gd-factor-bar"><div style={{ width: `${f.pct}%` }} /></div>
                                  <div className="gd-factor-note">{f.note}</div>
                                </div>
                              ))}
                            </div>
                            <div className="gd-why-sealed">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DBB863" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                              <div>
                                <div className="gd-why-sealed-t">Private screening: {s.screeningPassed ? 'compatible' : 'not compared'}</div>
                                <div className="gd-why-sealed-b">The confidential answers of both families were checked by the system alone. No reason is shown — to you, or to anyone.</div>
                              </div>
                            </div>
                            <div className="gd-why-feedback">
                              <span>Was this useful?</span>
                              <Button variant="outline" size="sm" onClick={() => say('Thank you — recorded as a good suggestion. Next week’s matching will weigh this.')}>Good suggestion</Button>
                              <Button variant="ghost" size="sm" onClick={() => say('Recorded as a poor suggestion. Tell us more in the weekly digest if you wish.')}>Poor suggestion</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* right rail */}
              <aside className="gd-rail">
                <div className="gd-quick">
                  <div className="gd-rail-bn">দ্রুত কাজ</div>
                  <div className="gd-rail-en">Quick actions</div>
                  <div className="gd-quick-list">
                    <div className="gd-quick-item primary" onClick={() => navigate('/add-profile')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DBB863" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                      <span><span className="gd-quick-t">নতুন প্রোফাইল যোগ করুন</span><span className="gd-quick-b">Add profile</span></span>
                    </div>
                    <div className="gd-quick-item" onClick={() => navigate('/biodata-studio')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F5233" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
                      <span><span className="gd-quick-t">বায়োডাটা তৈরি করুন</span><span className="gd-quick-b">Generate biodata PDF</span></span>
                    </div>
                    <div className="gd-quick-item" onClick={() => say('WhatsApp share link created. Expires in 7 days; contact details stay hidden until you release them.')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F5233" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
                      <span><span className="gd-quick-t">হোয়াটসঅ্যাপে পাঠান</span><span className="gd-quick-b">Share via WhatsApp</span></span>
                    </div>
                  </div>
                </div>

                <div className="gd-attest">
                  <div className="gd-attest-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8C6318" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                    <span>Needs your confirmation</span>
                  </div>
                  <div className="gd-attest-note">Profiles auto-archive at 90 days. One tap keeps them in the matching pool.</div>
                  <div className="gd-attest-list">
                    {attestQueue.length === 0 && <div className="gd-attest-note" style={{ marginTop: 4 }}>Nothing needs confirming right now.</div>}
                    {attestQueue.map((a) => (
                      <div key={a.id} className="gd-attest-item">
                        <div className="gd-attest-item-top"><span>{a.name}</span><span className="gd-attest-days">{a.days}d</span></div>
                        <div className="gd-attest-item-sub">{a.prn} · archives in {a.left} days</div>
                        <Button variant="primary" size="sm" style={{ width: '100%', marginTop: 9 }} onClick={() => attest(a)}>
                          I confirm this profile is still active
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            {/* profile list */}
            <section className="gd-panel">
              <div className="gd-panel-head">
                <div className="gd-panel-title-wrap">
                  <div className="gd-panel-bn">আমার প্রোফাইল তালিকা</div>
                  <div className="gd-panel-en">My profiles · {profiles.length} total · {shown.length} shown</div>
                </div>
                <Tabs items={filterTabs} active={filter} onChange={setFilter} style={{ border: 'none' }} />
              </div>
              <div className="gd-table-wrap">
                <div className="gd-table">
                  <div className="gd-thead">
                    <span>Profile</span><span>Education · profession</span><span>Location</span><span>Status</span><span>Network pool · updated</span>
                  </div>
                  {!loading && shown.length === 0 && (
                    <div className="gd-trow" style={{ color: 'var(--text-secondary)' }}>No profiles in this view yet.</div>
                  )}
                  {shown.map((p) => {
                    const on = p.pool;
                    const warn = !attested[p.id] && needsRefresh(p);
                    return (
                      <div key={p.id} className="gd-trow">
                        <div className="gd-cell-profile">
                          <div className={`gd-thumb ${p.locked ? 'locked' : ''}`}>
                            {p.locked ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            ) : p.init}
                          </div>
                          <div className="gd-cell-min">
                            <div className="gd-cell-name">
                              {p.name}
                              {p.verified && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B08628" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>}
                            </div>
                            <div className="gd-cell-prn">{p.prn || 'Draft'} · {p.age} · {p.height}</div>
                          </div>
                        </div>
                        <div className="gd-cell-min" data-label="Education">
                          <div className="gd-cell-strong">{p.edu}</div>
                          <div className="gd-cell-sub">{p.job}</div>
                        </div>
                        <div className="gd-cell-min" data-label="Location">
                          <div className="gd-cell-strong">{p.city}</div>
                          <div className="gd-cell-sub">{p.region}</div>
                        </div>
                        <div data-label="Status"><Badge tone={ST[p.status] || 'neutral'}>{p.status}</Badge></div>
                        <div className="gd-cell-pool" data-label="Pool">
                          <Switch checked={on} onChange={() => togglePool(p)} />
                          <div className="gd-cell-min">
                            <div className="gd-cell-sub" style={{ color: warn ? '#8C6318' : undefined }}>{updLabel(p)}</div>
                            {warn && <div className="gd-cell-refresh" onClick={() => attest(p)}>Tap to refresh</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="gd-table-foot">
                <span>Showing {shown.length} of {profiles.length}</span>
                <span className="gd-view-all" onClick={() => navigate('/search')}>View all profiles →</span>
              </div>
            </section>
          </div>
        </div>
      </div>

      {toast && (
        <div className="gd-toast">
          <span className="gd-toast-check">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
