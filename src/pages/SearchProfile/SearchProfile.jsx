import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Input, Select, Switch, Tag, ProfileCard, Dialog } from '../../components/ui/index.jsx';
import './SearchProfile.css';

const R = [
  { id: 'r1', prn: 'PRN-10245', name: 'Nusrat Jahan', age: 26, height: '5′4″', edu: 'MBA, IBA Dhaka', job: 'Banker', district: 'Dhanmondi, Dhaka', dcode: 'Dhaka', eduLevel: 'Postgraduate', managedBy: 'Rahima Akter (ghotok)', mgrMeta: 'GHT-0042 · Sylhet · 27 marriages', verified: true, screened: true, mine: true, family: 'Nuclear · father retired, BCS', siblings: 'One younger brother, student', religion: 'Sunni · moderately practising', looking: 'Postgraduate, within 4 years of age' },
  { id: 'r2', prn: 'PRN-20881', name: 'Sumaiya Haque', age: 24, height: '5′2″', edu: 'BSc Pharmacy, SUST', job: 'Pharmacist', district: 'Zindabazar, Sylhet', dcode: 'Sylhet', eduLevel: 'Graduate', managedBy: 'Kamrul Islam (ghotok)', mgrMeta: 'GHT-0311 · Sylhet · pool member', verified: true, screened: true, mine: false, family: 'Joint · family business', siblings: 'Two elder sisters, both married', religion: 'Sunni · strictly practising', looking: 'Settled in Sylhet or abroad' },
  { id: 'r3', prn: 'PRN-31204', name: 'Farhana Akter', age: 27, height: '5′3″', edu: 'BBA, North South', job: 'HR executive', district: 'Uttara, Dhaka', dcode: 'Dhaka', eduLevel: 'Graduate', managedBy: 'Guardian — Shirin Akter', mgrMeta: 'Mother · self-managed family', verified: false, screened: false, mine: false, family: 'Nuclear · father in service', siblings: 'One elder brother, engineer', religion: 'Sunni · culturally observant', looking: 'Dhaka-based, service holder' },
  { id: 'r4', prn: 'PRN-19077', name: 'Ayesha Siddika', age: 23, height: '5′1″', edu: 'Honours in Bangla', job: 'Student', district: 'Mymensingh Sadar', dcode: 'Mymensingh', eduLevel: 'Graduate', managedBy: 'Nazma Begum (ghotok)', mgrMeta: 'GHT-0198 · Mymensingh · pool member', verified: true, screened: false, mine: false, family: 'Joint · agricultural land', siblings: 'Three siblings, she is eldest', religion: 'Sunni · moderately practising', looking: 'Family known to ours preferred' },
  { id: 'r5', prn: 'PRN-24410', name: 'Rifat Jahan', age: 29, height: '5′5″', edu: 'MSc Economics, DU', job: 'Research associate', district: 'Khulshi, Chattogram', dcode: 'Chattogram', eduLevel: 'Postgraduate', managedBy: 'Rahima Akter (ghotok)', mgrMeta: 'GHT-0042 · Sylhet · 27 marriages', verified: true, screened: true, mine: true, family: 'Nuclear · both parents teachers', siblings: 'One younger sister, doctor', religion: 'Sunni · moderately practising', looking: 'Postgraduate, open to relocating' },
];

const opts = (a) => a.map((v) => ({ value: v, label: v }));
const SCOPES = [
  { value: 'mine', label: 'My profiles', count: '42', note: 'Profiles you manage yourself' },
  { value: 'pool', label: 'Trusted network pool', count: '1,240', note: 'Shared by verified ghotoks' },
  { value: 'all', label: 'Everything I can see', count: '1,282', note: 'Your book plus the pool' },
];
const SCOPE_NOTE = { mine: 'your own book', pool: 'trusted network pool', all: 'your book and the pool' };
const DEFAULT_FF = { gender: 'Bride', ageMin: 22, ageMax: 32, district: 'Any district', edu: 'Any level', verified: true, screened: false };

export default function SearchProfile() {
  const [scope, setScope] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('Recently updated');
  const [selected, setSelected] = useState('r2');
  const [ff, setFf] = useState(DEFAULT_FF);
  const [interest, setInterest] = useState({});
  const [photoReq, setPhotoReq] = useState({});
  const [released, setReleased] = useState({});
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null), iTimer = useRef(null), pTimer = useRef(null);

  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(iTimer.current); clearTimeout(pTimer.current); }, []);
  const setFF = (k, v) => setFf((s) => ({ ...s, [k]: v }));

  const matches = (r) => {
    if (scope === 'mine' && !r.mine) return false;
    if (scope === 'pool' && r.mine) return false;
    if (ff.verified && !r.verified) return false;
    if (ff.screened && !r.screened) return false;
    if (ff.district !== 'Any district' && r.dcode !== ff.district) return false;
    if (ff.edu !== 'Any level' && r.eduLevel !== ff.edu) return false;
    if (r.age < ff.ageMin || r.age > ff.ageMax) return false;
    const query = q.trim().toLowerCase();
    if (query && !(`${r.name} ${r.prn} ${r.edu} ${r.district}`.toLowerCase().includes(query))) return false;
    return true;
  };

  const list = R.filter(matches);
  const selRaw = R.find((r) => r.id === selected) || null;
  const sel = selRaw && list.some((r) => r.id === selRaw.id) ? selRaw : null;
  const iState = sel ? interest[sel.id] : null;
  const pState = sel ? photoReq[sel.id] : null;
  const isReleased = sel ? !!released[sel.id] : false;

  const chips = [];
  if (ff.verified) chips.push({ label: 'Verified only', k: 'verified' });
  if (ff.screened) chips.push({ label: 'Screening done', k: 'screened' });
  if (ff.district !== 'Any district') chips.push({ label: ff.district, k: 'district' });
  if (ff.edu !== 'Any level') chips.push({ label: ff.edu, k: 'edu' });
  const removeChip = (k) => setFF(k, k === 'district' ? 'Any district' : k === 'edu' ? 'Any level' : false);

  const contact = isReleased
    ? { title: 'Contact released', body: 'You released this family’s number to the guardian on the other side, and received theirs. Both releases are logged on the profile.', bd: 'var(--green-300)', bg: 'var(--green-100)', fg: 'var(--brand-primary)', icon: 'var(--brand-primary)' }
    : iState === 'accepted'
      ? { title: 'Contact not yet released', body: 'Interest was accepted. Releasing contact details is a separate, deliberate step — it cannot be undone, and both managers must agree.', bd: 'var(--gold-300)', bg: 'var(--gold-100)', fg: 'var(--gold-700)', icon: 'var(--gold-600)' }
      : { title: 'Contact details are hidden', body: 'Phone numbers and addresses stay sealed until interest is accepted and both managers release them. No exceptions, no paid unlock.', bd: 'var(--border-subtle)', bg: 'var(--surface-page)', fg: 'var(--text-primary)', icon: 'var(--text-secondary)' };

  const sendInterest = () => {
    const id = sel.id;
    setInterest((st) => ({ ...st, [id]: 'sent' }));
    say(`Interest sent to ${sel.managedBy} on behalf of your candidate. They decide whether to show it to the family.`);
    clearTimeout(iTimer.current);
    iTimer.current = setTimeout(() => { setInterest((st) => ({ ...st, [id]: 'accepted' })); say(`${sel.mgrMeta.split(' ')[0]} accepted the interest. Contact details still need a separate release.`); }, 2800);
  };

  const dlg = dialog === 'release'
    ? { title: 'Release contact details?', body: `You are about to share this family’s phone number with ${sel ? sel.managedBy : 'the other manager'}, and receive theirs in return. This cannot be undone, and both families are notified.`,
        actions: (<><Button variant="ghost" onClick={() => setDialog(null)}>Not yet</Button><Button variant="primary" onClick={() => { setReleased((st) => ({ ...st, [sel.id]: true })); setDialog(null); say('Contact released and logged. Both managers were notified — the families can speak directly now.'); }}>Release</Button></>) }
    : dialog === 'photo'
      ? { title: 'Request photo access?', body: 'The manager of this profile decides. They see who is asking, on whose behalf, and can release the photo for this request alone — not to the whole pool.',
          actions: (<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={() => { const id = sel.id; setPhotoReq((st) => ({ ...st, [id]: 'pending' })); setDialog(null); say(`Photo request sent to ${sel.managedBy}. You will be notified when they decide.`); clearTimeout(pTimer.current); pTimer.current = setTimeout(() => { setPhotoReq((st) => ({ ...st, [id]: 'granted' })); say('Photo access granted for this request only.'); }, 2600); }}>Send request</Button></>) }
      : null;

  const photoBtnLabel = pState === 'granted' ? 'Photo released' : pState === 'pending' ? 'Request pending…' : 'Request photo access';

  const rows = sel ? [
    { k: 'Education', v: sel.edu }, { k: 'Profession', v: sel.job }, { k: 'Family', v: sel.family },
    { k: 'Siblings', v: sel.siblings }, { k: 'Religious practice', v: sel.religion }, { k: 'Family is looking for', v: sel.looking },
  ] : [];

  return (
    <div className="sp">
      <div className="sp-frame">
        <div className="sp-topbar">
          <div className="sp-topbar-brand"><div className="sp-logo">স</div><span>SongiSathi</span></div>
          <div className="sp-topbar-tabs"><span>ড্যাশবোর্ড</span><span>প্রোফাইল</span><span className="on">অনুসন্ধান</span><span>এআই ম্যাচিং</span></div>
          <div className="sp-topbar-right"><Badge tone="gold">BUREAU</Badge><Avatar initials="RA" size={28} /></div>
        </div>

        <div className={`sp-grid ${sel ? 'has-panel' : ''}`}>
          {/* filters */}
          <div className="sp-filters">
            <div>
              <div className="sp-h-bn">অনুসন্ধান</div>
              <div className="sp-h-sub">Filter across your book and the pool</div>
            </div>
            <div className="sp-scopes">
              {SCOPES.map((sc) => (
                <div key={sc.value} className={`sp-scope ${scope === sc.value ? 'is-active' : ''}`} onClick={() => setScope(sc.value)}>
                  <div className="sp-scope-top"><span>{sc.label}</span><span className="sp-scope-count">{sc.count}</span></div>
                  <div className="sp-scope-note">{sc.note}</div>
                </div>
              ))}
            </div>
            <Select label="Looking for" value={ff.gender} onChange={(e) => setFF('gender', e.target.value)} options={opts(['Bride', 'Groom'])} />
            <div>
              <div className="sp-age-label">Age range</div>
              <div className="sp-age-row">
                <span>{ff.ageMin}</span>
                <input type="range" min="20" max="45" value={ff.ageMax} onChange={(e) => setFF('ageMax', Number(e.target.value))} className="sp-range" />
                <span>{ff.ageMax}</span>
              </div>
            </div>
            <Select label="District" value={ff.district} onChange={(e) => setFF('district', e.target.value)} options={opts(['Any district', 'Dhaka', 'Sylhet', 'Chattogram', 'Mymensingh'])} />
            <Select label="Education" value={ff.edu} onChange={(e) => setFF('edu', e.target.value)} options={opts(['Any level', 'Graduate', 'Postgraduate'])} />
            <div className="sp-switches">
              <Switch label="Verified profiles only" checked={ff.verified} onChange={() => setFF('verified', !ff.verified)} />
              <Switch label="Screening completed" checked={ff.screened} onChange={() => setFF('screened', !ff.screened)} />
            </div>
            <div className="sp-filter-actions">
              <Button variant="ghost" size="sm" onClick={() => { setFf({ ...DEFAULT_FF, verified: false }); setQ(''); }}>Reset</Button>
              <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={() => say('Search saved. New profiles matching it will appear in your Monday digest.')}>Save this search</Button>
            </div>
          </div>

          {/* results */}
          <div className="sp-results">
            <div className="sp-results-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input placeholder="নাম, PRN, প্রতিষ্ঠান খুঁজুন · Search name, PRN, institution" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={sort} onChange={(e) => setSort(e.target.value)} options={opts(['Recently updated', 'Compatibility', 'Newest first'])} />
            </div>
            <div className="sp-results-meta">
              <span>{list.length} profiles · {SCOPE_NOTE[scope]}</span>
              <div className="sp-chips">
                {chips.map((c) => (<Tag key={c.k} onRemove={() => removeChip(c.k)}>{c.label}</Tag>))}
              </div>
            </div>
            <div className="sp-cards">
              {list.map((r) => (
                <div key={r.id} style={{ borderRadius: 14, outline: selected === r.id ? '2px solid var(--brand-primary)' : '2px solid transparent', outlineOffset: 2 }}>
                  <ProfileCard profileId={r.prn} name={r.name} age={r.age} height={r.height} education={r.edu} district={r.district} managedBy={r.managedBy.split(' ')[0]} verified={r.verified} photoLocked={photoReq[r.id] !== 'granted'} onClick={() => setSelected(r.id)} />
                </div>
              ))}
              {list.length === 0 && (
                <div className="sp-empty">
                  <div className="sp-empty-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  </div>
                  <div className="sp-empty-t">No profiles match these filters</div>
                  <div className="sp-empty-b">Widen the age range, or search the trusted network pool — 1,240 profiles from verified ghotoks sit outside your own book.</div>
                  <div className="sp-empty-actions">
                    <Button variant="outline" size="sm" onClick={() => { setFf({ ...DEFAULT_FF, verified: false }); setQ(''); }}>Clear filters</Button>
                    <Button variant="primary" size="sm" onClick={() => setScope('pool')}>Search the pool</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* detail panel */}
          {sel && (
            <div className="sp-panel">
              <div className="sp-panel-head">
                <span className="sp-panel-label">Profile detail</span>
                <span className="sp-panel-close" onClick={() => setSelected(null)}>Close</span>
              </div>
              <div className="sp-panel-body">
                <div className="sp-panel-hero">
                  <div className="sp-panel-photo">
                    <div className="sp-panel-photo-bg" style={{ filter: pState === 'granted' ? 'none' : 'blur(5px)' }} />
                    {pState !== 'granted' && (
                      <div className="sp-panel-photo-lock">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                        <span>{pState === 'pending' ? 'Request pending' : 'Request photo access'}</span>
                      </div>
                    )}
                  </div>
                  <div className="sp-panel-hero-info">
                    <div className="sp-panel-name-row">
                      <span className="sp-panel-name">{sel.name}</span>
                      {sel.verified && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2.6l2.3 1.7 2.8-.3 1.1 2.6 2.4 1.5-.6 2.8.9 2.7-2.2 1.8-.8 2.7-2.9.2L12 21.4l-2.9-1.8-2.9-.2-.8-2.7L3.2 15l.9-2.7-.6-2.8L5.9 8 7 5.4l2.8.3z" fill="var(--gold-600)" /><path d="M9 12.2l2.1 2.1 4-4.2" stroke="#FDFBF6" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <div className="sp-panel-prn">{sel.prn}</div>
                    <div className="sp-panel-basics">{sel.age} years · {sel.height}<br />{sel.district}</div>
                    <div className="sp-panel-badges">
                      <Badge tone={sel.screened ? 'success' : 'neutral'}>{sel.screened ? 'Screening complete' : 'Screening pending'}</Badge>
                      <Badge tone="neutral">{sel.mine ? 'Your profile' : 'Network pool'}</Badge>
                    </div>
                  </div>
                </div>

                <div className="sp-block">
                  <div className="sp-block-label">Biodata</div>
                  <div className="sp-rows">
                    {rows.map((rw) => (<div key={rw.k} className="sp-row"><span className="sp-row-k">{rw.k}</span><span className="sp-row-v">{rw.v}</span></div>))}
                  </div>
                </div>

                <div className="sp-block">
                  <div className="sp-mgr">
                    <Avatar initials={sel.managedBy.slice(0, 2).toUpperCase()} size={30} />
                    <div><div className="sp-mgr-name">{sel.managedBy}</div><div className="sp-mgr-meta">{sel.mgrMeta}</div></div>
                  </div>
                  <div className="sp-mgr-note">Every message and every contact detail passes through this manager. Nothing reaches the candidate directly.</div>
                </div>

                <div className="sp-contact" style={{ borderColor: contact.bd, background: contact.bg }}>
                  <div className="sp-contact-head">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={contact.icon} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                    <span style={{ color: contact.fg }}>{contact.title}</span>
                  </div>
                  <div className="sp-contact-body">{contact.body}</div>
                  {isReleased && (
                    <div className="sp-contact-reveal">
                      <span className="sp-contact-num">+880 1712 ••• 340</span>
                      <span className="sp-contact-log">released 8 Aug, logged</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sp-panel-actions">
                {!iState && <Button variant="primary" style={{ width: '100%' }} onClick={sendInterest}>আগ্রহ পাঠান · Send interest</Button>}
                {iState === 'sent' && <div className="sp-interest-sent">Interest sent — awaiting {sel.managedBy.split(' ')[0]}’s reply</div>}
                {iState === 'accepted' && !isReleased && <Button variant="primary" style={{ width: '100%' }} onClick={() => setDialog('release')}>Release contact details</Button>}
                <div className="sp-panel-actions-row">
                  <Button variant="outline" style={{ flex: 1 }} onClick={() => { if (pState !== 'granted') setDialog('photo'); else say('Photo already released for this request.'); }}>{photoBtnLabel}</Button>
                  <Button variant="ghost" style={{ flex: 1 }} onClick={() => say(`${sel.name} added to your shortlist for this candidate.`)}>Shortlist</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!dlg} title={dlg ? dlg.title : ''} actions={dlg ? dlg.actions : null}>{dlg ? dlg.body : ''}</Dialog>

      {toast && (<div className="sp-toast"><span className="sp-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
