import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Avatar, Switch, Tabs } from '../../components/ui/index.jsx';
import './GhotokDashboard.css';

const P = [
  { id: 'p1', init: 'NJ', name: 'Nusrat Jahan', prn: 'PRN-10245', age: 26, height: '5′4″', edu: 'MBA, IBA Dhaka', job: 'Banker', city: 'Dhanmondi', region: 'Dhaka', status: 'Active', upd: 'Updated 12 days ago', verified: true, locked: false, days: 12 },
  { id: 'p2', init: 'TA', name: 'Tanvir Ahmed', prn: 'PRN-10188', age: 31, height: '5′9″', edu: 'MSc CSE, BUET', job: 'Software engineer', city: 'Auckland', region: 'New Zealand', status: 'In discussion', upd: 'Updated 4 days ago', verified: true, locked: false, days: 4 },
  { id: 'p3', init: 'SI', name: 'Sadia Islam', prn: 'PRN-10302', age: 24, height: '5′2″', edu: 'BSc Pharmacy, SUST', job: 'Pharmacist', city: 'Zindabazar', region: 'Sylhet', status: 'Match in progress', upd: 'Updated 78 days ago', verified: false, locked: true, days: 78 },
  { id: 'p4', init: 'RK', name: 'Rezaul Karim', prn: 'PRN-10077', age: 29, height: '5′11″', edu: 'LLB, Chittagong Univ.', job: 'Advocate', city: 'Khulshi', region: 'Chattogram', status: 'Active', upd: 'Updated 33 days ago', verified: true, locked: false, days: 33 },
  { id: 'p5', init: 'FA', name: 'Farhana Akter', prn: 'PRN-10411', age: 27, height: '5′3″', edu: 'BBA, North South', job: 'HR executive', city: 'Uttara', region: 'Dhaka', status: 'Married', upd: 'Closed 2 days ago', verified: true, locked: false, days: 2 },
  { id: 'p6', init: 'MH', name: 'Mahmudul Hasan', prn: 'PRN-10015', age: 34, height: '5′8″', edu: 'MBBS, Rajshahi Med.', job: 'Doctor', city: 'Boalia', region: 'Rajshahi', status: 'Active', upd: 'Updated 86 days ago', verified: true, locked: false, days: 86 },
  { id: 'p7', init: 'AS', name: 'Ayesha Siddika', prn: 'PRN-10466', age: 23, height: '5′1″', edu: 'Honours in Bangla', job: 'Student', city: 'Mymensingh', region: 'Mymensingh', status: 'Auto-archived', upd: 'Archived at 90 days', verified: false, locked: true, days: 91 },
  { id: 'p8', init: 'IC', name: 'Imran Chowdhury', prn: 'PRN-10233', age: 30, height: '5′10″', edu: 'MEng, Univ. of Toronto', job: 'Civil engineer', city: 'Toronto', region: 'Canada', status: 'In discussion', upd: 'Updated 9 days ago', verified: true, locked: false, days: 9 },
];

const ST = {
  Active: 'success',
  'In discussion': 'pending',
  'Match in progress': 'warning',
  Married: 'gold',
  'Auto-archived': 'neutral',
};

const SUGS = [
  { id: 's1', aId: 'p1', bId: 'p2', score: 87, factors: [
    { label: 'Education', pct: 94, note: 'Both postgraduate, business + technical' },
    { label: 'Family type', pct: 88, note: 'Nuclear, both fathers retired service' },
    { label: 'Location', pct: 79, note: 'Dhaka family, Auckland-settled groom' },
    { label: 'Lifestyle', pct: 85, note: 'Similar practice level, both non-smoking' }] },
  { id: 's2', aId: 'p3', bId: 'p4', score: 81, factors: [
    { label: 'Education', pct: 83, note: 'Professional degrees on both sides' },
    { label: 'Family type', pct: 90, note: 'Joint family, both Sylhet-rooted' },
    { label: 'Location', pct: 72, note: 'Sylhet and Chattogram — travel expected' },
    { label: 'Lifestyle', pct: 80, note: 'Age gap of five years, both agreed' }] },
  { id: 's3', aId: 'p7', bId: 'p8', score: 74, factors: [
    { label: 'Education', pct: 68, note: 'Honours vs. postgraduate' },
    { label: 'Family type', pct: 82, note: 'Both nuclear, elder-led decisions' },
    { label: 'Location', pct: 64, note: 'Mymensingh family, Toronto-settled groom' },
    { label: 'Lifestyle', pct: 81, note: 'Both open to settling abroad' }] },
];

const NAV = [
  { bn: 'ড্যাশবোর্ড', en: 'Dashboard', count: '', to: '/dashboard' },
  { bn: 'প্রোফাইল', en: 'Profiles', count: '42', to: '/search' },
  { bn: 'অনুসন্ধান', en: 'Search', count: '', to: '/search' },
  { bn: 'এআই ম্যাচিং', en: 'AI matching', count: '9', to: '/ai-matching' },
  { bn: 'বায়োডাটা', en: 'Biodata studio', count: '', to: '/biodata-studio' },
  { bn: 'কমিশন', en: 'Commission', count: '4', to: '/commission' },
  { bn: 'নেটওয়ার্ক পুল', en: 'Network pool', count: '', to: '/search' },
];

const find = (id) => P.find((p) => p.id === id);

export default function GhotokDashboard() {
  const navigate = useNavigate();
  const [langBn, setLangBn] = useState(true);
  const [sugState, setSugState] = useState({});
  const [whyOpen, setWhyOpen] = useState(null);
  const [pool, setPool] = useState({ p1: true, p2: true, p3: false, p4: true, p5: false, p6: true, p7: false, p8: false });
  const [attested, setAttested] = useState({});
  const [filter, setFilter] = useState('all');
  const [closed, setClosed] = useState(27);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pairLabel = (s) => `${find(s.aId).name} ↔ ${find(s.bId).name}`;

  const filtered =
    filter === 'discussion' ? P.filter((p) => p.status === 'In discussion')
      : filter === 'refresh' ? P.filter((p) => p.days >= 75 && p.status !== 'Auto-archived')
        : filter === 'married' ? P.filter((p) => p.status === 'Married')
          : P;
  const profiles = filtered.slice(0, 6);

  const stats = [
    { bn: 'সক্রিয় প্রোফাইল', en: 'Active profiles', val: '42', sub: '/ 50', meter: 84, foot: '8 slots left on Bureau', footColor: '#8C6318' },
    { bn: 'এ সপ্তাহের প্রস্তাব', en: 'Matches suggested', val: '9', foot: '3 awaiting your review', footColor: '#3D6B44' },
    { bn: 'চলমান পরিচয়', en: 'Introductions in progress', val: '5', foot: '2 need a follow-up call', footColor: '#BD572F' },
    { bn: 'সম্পন্ন বিবাহ', en: 'Marriages closed · lifetime', val: String(closed), dark: true, foot: 'Record a marriage' },
    { bn: 'এ মাসের কমিশন', en: 'Commission earned', val: '৳48,000', foot: '3 of 4 payments received', footColor: '#3D6B44' },
  ];

  const attestQueue = [
    { id: 'p3', name: 'Sadia Islam', prn: 'PRN-10302', days: 78, left: 12 },
    { id: 'p6', name: 'Mahmudul Hasan', prn: 'PRN-10015', days: 86, left: 4 },
  ];

  const filterTabs = [
    { value: 'all', label: 'All', count: 42 },
    { value: 'discussion', label: 'In discussion', count: 2 },
    { value: 'refresh', label: 'Needs refresh', count: 2 },
    { value: 'married', label: 'Married', count: 1 },
  ];

  const markMarried = () => { setClosed((c) => c + 1); say('Congratulations — marriage closed. That is 28 in your career.'); };

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
              <Badge tone="gold">BUREAU</Badge>
              <span className="gd-tier-verified">Verified</span>
            </div>
            <div className="gd-tier-count">
              <span className="gd-tier-num">42<span>/50</span></span>
              <span className="gd-tier-label">সক্রিয় প্রোফাইল</span>
            </div>
            <div className="gd-tier-bar"><div style={{ width: '84%' }} /></div>
            <div className="gd-tier-upgrade" onClick={() => say('Upgrade to the 150-profile plan — ৳5,000/mo, or ৳4,000 on annual billing.')}>
              84% used · Upgrade for 150 →
            </div>
          </div>

          <nav className="gd-nav">
            {NAV.map((n, i) => (
              <div key={n.en + i} className={`gd-nav-item ${i === 0 ? 'is-active' : ''}`} onClick={() => n.to && navigate(n.to)}>
                <span className="gd-nav-dot" />
                <span className="gd-nav-labels">
                  <span className="gd-nav-bn">{n.bn}</span>
                  <span className="gd-nav-en">{n.en}</span>
                </span>
                {n.count && <span className="gd-nav-count">{n.count}</span>}
              </div>
            ))}
          </nav>

          <div className="gd-referral">
            <div className="gd-referral-title">সহকর্মী ঘটককে আমন্ত্রণ করুন</div>
            <div className="gd-referral-body">Invite a fellow ghotok — you both get one month free.</div>
            <div className="gd-referral-code" onClick={() => say('Invite link copied. When your colleague activates, you both get one month free.')}>
              <span>RAHIMA-SYL</span>
              <span className="gd-referral-copy">Copy</span>
            </div>
          </div>
        </aside>

        {/* --- main --- */}
        <div className="gd-main">
          <header className="gd-header">
            <div className="gd-header-greet">
              <div className="gd-header-bn">শুভ সকাল, রাহিমা আপা</div>
              <div className="gd-header-en">Good morning · Sylhet bureau · 22 years of matchmaking</div>
            </div>
            <div className="gd-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#AA9683" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <span>প্রোফাইল খুঁজুন · Search profiles</span>
            </div>
            <button className="gd-lang" onClick={() => { setLangBn((v) => !v); say(langBn ? 'Interface language set to English. Bangla stays as the caption layer.' : 'বাংলা ইন্টারফেস চালু হলো। ইংরেজি ক্যাপশন হিসেবে থাকবে।'); }}>
              <span className={langBn ? 'on' : ''} style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>বাংলা</span>
              <span className={!langBn ? 'on' : ''}>EN</span>
            </button>
            <div className="gd-user">
              <Avatar initials="RA" size={32} />
              <div>
                <div className="gd-user-name">Rahima Akter</div>
                <div className="gd-user-id">GHT-0042</div>
              </div>
            </div>
          </header>

          <div className="gd-body">
            {/* stats */}
            <div className="gd-stats">
              {stats.map((s, i) => (
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
                    <button className="gd-stat-record" onClick={markMarried}>Record a marriage</button>
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
                    <div className="gd-panel-en">AI match suggestions · refreshed Monday, 4 August</div>
                  </div>
                  <span className="gd-screen-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2F5233" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
                    Private screening applied
                  </span>
                </div>

                <div className="gd-sugs">
                  {SUGS.map((s) => {
                    const st = sugState[s.id];
                    const a = find(s.aId), b = find(s.bId);
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
                                  <div className="gd-sug-thumb">{person.init}</div>
                                  <div className="gd-sug-person-info">
                                    <div className="gd-sug-name">{person.name}</div>
                                    <div className="gd-sug-meta">{person.age} · {person.job} · {person.city}</div>
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
                                <Button variant="ghost" size="sm" onClick={() => { setSugState((p) => ({ ...p, [s.id]: 'dismissed' })); setWhyOpen(null); say('Dismissed. The system will not suggest this pair again this quarter.'); }}>Dismiss</Button>
                                <Button variant="primary" size="sm" onClick={() => { setSugState((p) => ({ ...p, [s.id]: 'accepted' })); setWhyOpen(null); say(`Introduction sent to both guardians on WhatsApp. ${pairLabel(s)} is now in progress.`); }}>Introduce · পরিচয় করান</Button>
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
                                <div className="gd-why-sealed-t">Private screening: compatible</div>
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
                    {attestQueue.map((a) => {
                      const done = !!attested[a.id];
                      return (
                        <div key={a.id} className="gd-attest-item">
                          <div className="gd-attest-item-top"><span>{a.name}</span><span className="gd-attest-days">{a.days}d</span></div>
                          <div className="gd-attest-item-sub">{a.prn} · archives in {a.left} days</div>
                          {done ? (
                            <div className="gd-attest-done">Confirmed · 90 days reset</div>
                          ) : (
                            <Button variant="primary" size="sm" style={{ width: '100%', marginTop: 9 }} onClick={() => { setAttested((p) => ({ ...p, [a.id]: true })); say(`${a.name} confirmed as active and accurate. Archive clock reset to 90 days.`); }}>
                              I confirm this profile is still active
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>

            {/* profile list */}
            <section className="gd-panel">
              <div className="gd-panel-head">
                <div className="gd-panel-title-wrap">
                  <div className="gd-panel-bn">আমার প্রোফাইল তালিকা</div>
                  <div className="gd-panel-en">My profiles · 42 active · {profiles.length} shown</div>
                </div>
                <Tabs items={filterTabs} active={filter} onChange={setFilter} style={{ border: 'none' }} />
              </div>
              <div className="gd-table-wrap">
                <div className="gd-table">
                  <div className="gd-thead">
                    <span>Profile</span><span>Education · profession</span><span>Location</span><span>Status</span><span>Network pool · updated</span>
                  </div>
                  {profiles.map((p) => {
                    const on = !!pool[p.id];
                    const isAtt = !!attested[p.id];
                    const warn = !isAtt && p.days >= 75 && p.status !== 'Auto-archived';
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
                            <div className="gd-cell-prn">{p.prn} · {p.age} · {p.height}</div>
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
                        <div data-label="Status"><Badge tone={ST[p.status]}>{p.status}</Badge></div>
                        <div className="gd-cell-pool" data-label="Pool">
                          <Switch checked={on} onChange={() => { setPool((s) => ({ ...s, [p.id]: !s[p.id] })); say(on ? `${p.name} removed from the trusted network pool. Only you can see this profile now.` : `${p.name} is now visible to trusted-network matching. Contact still routes through you.`); }} />
                          <div className="gd-cell-min">
                            <div className="gd-cell-sub" style={{ color: warn ? '#8C6318' : undefined }}>{isAtt ? 'Confirmed today' : p.upd}</div>
                            {warn && <div className="gd-cell-refresh" onClick={() => { setAttested((s) => ({ ...s, [p.id]: true })); say(`${p.name} confirmed as active. The 90-day archive clock has reset.`); }}>Tap to refresh</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="gd-table-foot">
                <span>Showing {profiles.length} of 42</span>
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
