import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge } from '../../components/ui/index.jsx';
import './GuardianCandidate.css';

const PROPOSALS = [
  { id: 'p1', name: 'Tanvir Ahmed', prn: 'PRN-10188', meta: '31 · MSc Computer Science, BUET · software engineer, settled in Auckland',
    note: 'I have known this family for eleven years. His father taught at the college in Sylhet. They are not in a hurry and they were the ones who asked whether Nusrat intends to keep working — they consider it a good thing.',
    facts: [{ k: 'Family', v: 'Nuclear, father retired teacher' }, { k: 'Siblings', v: 'One sister, married' }, { k: 'Practice', v: 'Moderately practising' }, { k: 'After marriage', v: 'Auckland, visits twice a year' }] },
  { id: 'p2', name: 'Imran Chowdhury', prn: 'PRN-10233', meta: '30 · MEng, University of Toronto · civil engineer',
    note: 'A newer family to me, but their ghotok is someone I trust. Worth a conversation. They have asked for nothing beyond the biodata so far, which I take as a good sign.',
    facts: [{ k: 'Family', v: 'Nuclear, father in service' }, { k: 'Siblings', v: 'Two brothers, students' }, { k: 'Practice', v: 'Culturally observant' }, { k: 'After marriage', v: 'Toronto, undecided' }] },
];

const RES = {
  interested: { label: 'Rahima Akter has been told you are interested', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  shown: { label: 'Shared with Nusrat — awaiting her word', bg: 'var(--gold-100)', fg: 'var(--gold-700)' },
  passed: { label: 'Declined — “not the right fit at this time”', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' },
};
const CRES = { yes: { label: 'Passed on to your mother', bg: 'var(--green-100)', fg: 'var(--brand-primary)' }, no: { label: 'Declined — no reason was shared', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' } };

const VISIBILITY = [
  { label: 'Biodata: education, profession, family, expectations', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  { label: 'District only — never your address', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  { label: 'Photograph — only when you release it', mark: '!', bg: 'var(--gold-200)', fg: 'var(--gold-700)' },
  { label: 'Phone number — only after both families agree', mark: '!', bg: 'var(--gold-200)', fg: 'var(--gold-700)' },
  { label: 'Your private answers — never, to anyone', mark: '–', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' },
];
const ACTIVITY = [
  { text: 'Rahima Akter passed you a proposal from Kamrul Islam', when: '2 hours ago' },
  { text: 'Photo access requested for one proposal', when: 'Yesterday' },
  { text: 'Private answers sealed', when: '8 August' },
  { text: 'Profile confirmed active for another 90 days', when: '8 August' },
];
const CANNOT = ['Search or browse other profiles', 'Message another family directly', 'See who has viewed your biodata'];

export default function GuardianCandidate() {
  const [decision, setDecision] = useState({});
  const [candidate, setCandidate] = useState({});
  const [photo, setPhoto] = useState('pending');
  const [photoReleased, setPhotoReleased] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const awaitingCount = PROPOSALS.filter((p) => !decision[p.id]).length;

  return (
    <div className="gc">
      <div className="gc-grid">
        {/* guardian */}
        <div className="gc-guardian">
          <div className="gc-topbar">
            <div className="gc-topbar-brand"><div className="gc-logo">স</div><span>SongiSathi</span></div>
            <span className="gc-topbar-note">Guardian view · Nusrat Jahan</span>
            <div className="gc-topbar-right"><span>{awaitingCount} awaiting your word</span><Avatar initials="SA" size={28} /></div>
          </div>

          <div className="gc-guardian-body">
            <div className="gc-guardian-main">
              <div>
                <div className="gc-h-bn">আপনার সিদ্ধান্তের অপেক্ষায়</div>
                <div className="gc-h-sub">Proposals your ghotok has passed to you. Nothing moves without your word.</div>
              </div>
              {PROPOSALS.map((p) => {
                const d = decision[p.id]; const r = RES[d];
                const locked = !photoReleased || p.id !== 'p1';
                return (
                  <div key={p.id} className="gc-proposal">
                    <div className="gc-proposal-top">
                      <div className="gc-photo">
                        <div className="gc-photo-bg" style={{ filter: locked ? 'blur(5px)' : 'none' }} />
                        {locked && (<div className="gc-photo-lock"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg></div>)}
                      </div>
                      <div className="gc-proposal-info">
                        <div className="gc-proposal-name-row">
                          <span className="gc-proposal-name">{p.name}</span>
                          <span className="gc-proposal-prn">{p.prn}</span>
                          <span style={{ marginLeft: 'auto' }}><Badge tone="success">Compatible</Badge></span>
                        </div>
                        <div className="gc-proposal-meta">{p.meta}</div>
                        <div className="gc-facts">
                          {p.facts.map((ft) => (<div key={ft.k} className="gc-fact"><span className="gc-fact-k">{ft.k}</span><span className="gc-fact-v">{ft.v}</span></div>))}
                        </div>
                      </div>
                    </div>
                    <div className="gc-note">
                      <div className="gc-note-label">Rahima Akter’s note</div>
                      <div className="gc-note-body">{p.note}</div>
                    </div>
                    {d ? (
                      <div className="gc-res" style={{ background: r.bg, color: r.fg }}>{r.label}</div>
                    ) : (
                      <div className="gc-proposal-actions">
                        <Button variant="primary" onClick={() => { setDecision((s) => ({ ...s, [p.id]: 'interested' })); say('Rahima Akter has been told. She will speak to the other manager — no contact details move yet.'); }}>আগ্রহী · We are interested</Button>
                        <Button variant="outline" onClick={() => { setDecision((s) => ({ ...s, [p.id]: 'shown' })); say('Shared with Nusrat. She sees the biodata and can say yes or no without giving a reason.'); }}>Show my daughter first</Button>
                        <Button variant="ghost" onClick={() => { setDecision((s) => ({ ...s, [p.id]: 'passed' })); say('Declined politely. The other family is told only that it was not the right fit.'); }}>Not now</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="gc-guardian-rail">
              <div className="gc-card">
                <div className="gc-card-t">What the other side can see</div>
                <div className="gc-vis-list">
                  {VISIBILITY.map((v) => (
                    <div key={v.label} className="gc-vis"><span className="gc-vis-mark" style={{ background: v.bg, color: v.fg }}>{v.mark}</span><span>{v.label}</span></div>
                  ))}
                </div>
              </div>
              <div className="gc-sealed">
                <div className="gc-sealed-head">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                  <span>Private answers sealed</span>
                </div>
                <div className="gc-sealed-body">Sealed 8 August. Not readable by your ghotok, the other family, or SongiSathi.</div>
                <div className="gc-photo-req">
                  <div className="gc-photo-req-t">Photo request · Sumaiya Haque’s family</div>
                  {photo === 'pending' ? (
                    <div className="gc-photo-req-actions">
                      <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => { setPhoto('released'); setPhotoReleased(true); say('Photo released for this one proposal. It is not added to the biodata or the pool.'); }}>Release for this one</Button>
                      <Button variant="outline" size="sm" onClick={() => { setPhoto('denied'); say('Not released. The other family is told only that the photo is on request.'); }}>Not yet</Button>
                    </div>
                  ) : (
                    <div className="gc-photo-req-res" style={{ color: photo === 'released' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>{photo === 'released' ? 'Released for this proposal only · 8 Aug' : 'Not released — you can change this any time'}</div>
                  )}
                </div>
              </div>
              <div className="gc-card">
                <div className="gc-card-t">Activity</div>
                <div className="gc-activity">
                  {ACTIVITY.map((ac, i) => (<div key={i}><div className="gc-activity-text">{ac.text}</div><div className="gc-activity-when">{ac.when}</div></div>))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* candidate */}
        <div className="gc-candidate">
          <div className="gc-cand-head">
            <div className="gc-cand-status"><span>9:41</span><span>4G · 78%</span></div>
            <div className="gc-cand-bn">নুসরাত, আসসালামু আলাইকুম</div>
            <div className="gc-cand-sub">Your mother and Rahima Akter have looked at 14 proposals this month. Two are worth your time.</div>
          </div>
          <div className="gc-cand-body">
            {PROPOSALS.map((p) => {
              const d = candidate[p.id]; const r = CRES[d];
              return (
                <div key={p.id} className="gc-cand-card">
                  <div className="gc-cand-top">
                    <div className="gc-photo sm"><div className="gc-photo-bg" style={{ filter: 'blur(5px)' }} /><div className="gc-photo-lock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg></div></div>
                    <div className="gc-cand-info">
                      <div className="gc-cand-name">{p.name}</div>
                      <div className="gc-cand-meta">{p.meta}</div>
                      <div className="gc-cand-shared">Shared with you by your mother</div>
                    </div>
                  </div>
                  {d ? (
                    <div className="gc-res" style={{ background: r.bg, color: r.fg }}>{r.label}</div>
                  ) : (
                    <div className="gc-cand-actions">
                      <div className="gc-cand-yes" onClick={() => { setCandidate((s) => ({ ...s, [p.id]: 'yes' })); say('Passed on to your mother. She continues from here.'); }}>ভালো লেগেছে</div>
                      <div className="gc-cand-no" onClick={() => { setCandidate((s) => ({ ...s, [p.id]: 'no' })); say('Declined. No reason was recorded and none will be asked for.'); }}>আগ্রহী নই</div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="gc-cand-note">
              <div className="gc-cand-note-t">Saying no costs you nothing</div>
              <div className="gc-cand-note-b">A “not interested” is passed on as a family decision, with no reason attached and no note about you. Your mother sees the count, not your reasoning.</div>
            </div>
            <div className="gc-cannot">
              <div className="gc-cannot-t">What you cannot do here</div>
              <div className="gc-cannot-list">
                {CANNOT.map((cn) => (<div key={cn} className="gc-cannot-item"><span className="gc-cannot-dot">–</span><span>{cn}</span></div>))}
              </div>
              <div className="gc-cannot-note">Search, messaging, and contact details sit with your guardian and ghotok. This is the product working as intended, not a limitation of your account.</div>
            </div>
          </div>
        </div>
      </div>

      {toast && (<div className="gc-toast"><span className="gc-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
