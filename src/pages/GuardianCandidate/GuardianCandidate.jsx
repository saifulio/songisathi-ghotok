import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMyProfiles } from '../../context/MyProfilesContext.jsx';
import { api } from '../../lib/api.js';
import PageFrame from '../../components/PageFrame.jsx';
import './GuardianCandidate.css';

// Resolved status → resolution ribbon. Guardian and candidate share the same
// three-state model (interested/shown is guardian-only local flavor;
// accepted/declined come straight from the API).
const RES = {
  accepted: { label: 'You told them you are interested — contact still stays sealed', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  shown: { label: 'Shared with the candidate — awaiting their word', bg: 'var(--gold-100)', fg: 'var(--gold-700)' },
  declined: { label: 'Declined — “not the right fit at this time”', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' },
  expired: { label: 'Held', bg: 'var(--gold-100)', fg: 'var(--gold-700)' },
};
const CRES = { accepted: { label: 'Passed on to your guardian', bg: 'var(--green-100)', fg: 'var(--brand-primary)' }, declined: { label: 'Declined — no reason was shared', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' } };

const VISIBILITY = [
  { label: 'Biodata: education, profession, family, expectations', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  { label: 'District only — never your address', mark: '✓', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
  { label: 'Photograph — only when you release it', mark: '!', bg: 'var(--gold-200)', fg: 'var(--gold-700)' },
  { label: 'Phone number — only after both families agree', mark: '!', bg: 'var(--gold-200)', fg: 'var(--gold-700)' },
  { label: 'Your private answers — never, to anyone', mark: '–', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' },
];
const CANNOT = ['Search or browse other profiles', 'Message another family directly', 'See who has viewed your biodata'];

export default function GuardianCandidate() {
  const { user, token } = useAuth();
  // Which family member this page is about — a guardian switches between
  // several from the bar above (see ProfileSwitcher).
  const { activeId } = useMyProfiles();
  const role = user?.role; // 'GUARDIAN' | 'CANDIDATE'
  const [profile, setProfile] = useState(null);
  const [selfManaged, setSelfManaged] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  // "Shown to the candidate" has no backing DB state (there is no
  // intermediate status between pending and accepted/declined) — kept as a
  // local, ephemeral flag rather than fabricating one server-side.
  const [shown, setShown] = useState({});
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    Promise.all([api.myProfile(token, activeId), api.myProposals(token, activeId), api.myActivity(token, activeId)])
      .then(([p, props, act]) => {
        if (!live) return;
        setProfile(p.profile);
        setSelfManaged(p.selfManaged);
        setProposals(props.proposals);
        setActivity(act.activity);
      })
      .catch((e) => say(e.message || 'Could not load your proposals.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, activeId, say]);

  // A proposal's photo unlocks once a photo request naming the same
  // candidate has been accepted — derived from real data, not a single
  // hardcoded id.
  const unlockedProfileIds = new Set(
    proposals.filter((p) => p.kind === 'photo' && p.status === 'accepted').map((p) => p.theirProfileId)
  );
  const photoRequest = proposals.find((p) => p.kind === 'photo' && p.status === 'pending');

  // interestItem() returns the DB status verbatim ('pending', 'accepted', …) —
  // 'pending' is the "still open" sentinel here, not a falsy value.
  const displayStatus = (p) => (shown[p.id] === true && p.status === 'pending' ? 'shown' : p.status);
  const isOpen = (status) => status === 'pending';
  const decisionable = proposals.filter((p) => p.kind !== 'photo');
  const awaitingCount = decisionable.filter((p) => isOpen(displayStatus(p))).length;

  // Optimistic accept/decline, reverted on error.
  const decide = async (id, apiDecision, localStatus, successMsg) => {
    const prev = proposals;
    setProposals((list) => list.map((x) => (x.id === id ? { ...x, status: localStatus } : x)));
    try {
      await api.decideProposal(token, id, { decision: apiDecision }, activeId);
      say(successMsg);
    } catch (e) {
      setProposals(prev);
      say(e.message || 'Could not record that decision.');
    }
  };

  const singlePane = { gridTemplateColumns: '1fr' };

  return (
    <PageFrame
      note={`Guardian view${profile ? ` · ${profile.name}` : ''}`}
      right={<><span>{awaitingCount} awaiting your word</span><Avatar initials={profile?.init || ''} size={28} /></>}
    >
      <div className="gc-grid" style={role !== 'GUARDIAN' && role !== 'CANDIDATE' ? undefined : singlePane}>
        {/* guardian */}
        {role === 'GUARDIAN' && (
        <div className="gc-guardian">

          <div className="gc-guardian-body">
            <div className="gc-guardian-main">
              <div>
                <div className="gc-h-bn">আপনার সিদ্ধান্তের অপেক্ষায়</div>
                <div className="gc-h-sub">Proposals routed to your family's profile. Nothing moves without your word.</div>
              </div>
              {loading && <div className="gc-proposal">Loading…</div>}
              {!loading && !profile && (
                <div className="gc-proposal">
                  No profile is linked to your account yet.{' '}
                  <a className="gc-add-link" href="/my-add-profile">Add the family member you are matchmaking for</a> to start receiving proposals.
                </div>
              )}
              {!loading && profile && decisionable.length === 0 && <div className="gc-proposal">No proposals yet.</div>}
              {decisionable.map((p) => {
                const d = displayStatus(p); const r = RES[d];
                const locked = !unlockedProfileIds.has(p.theirProfileId);
                return (
                  <div key={p.id} className="gc-proposal">
                    <div className="gc-proposal-top">
                      <div className="gc-photo">
                        <div className="gc-photo-bg" style={{ filter: locked ? 'blur(5px)' : 'none' }} />
                        {locked && (<div className="gc-photo-lock"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg></div>)}
                      </div>
                      <div className="gc-proposal-info">
                        <div className="gc-proposal-name-row">
                          <span className="gc-proposal-name">{p.theirName}</span>
                          <span className="gc-proposal-prn">{p.theirPrn}</span>
                          <span style={{ marginLeft: 'auto' }}><Badge tone={p.screeningResult === 'Compatible' ? 'success' : 'neutral'}>{p.screeningResult}</Badge></span>
                        </div>
                        <div className="gc-proposal-meta">{p.theirMeta}</div>
                        <div className="gc-facts">
                          {p.theirFacts.map((ft) => (<div key={ft.k} className="gc-fact"><span className="gc-fact-k">{ft.k}</span><span className="gc-fact-v">{ft.v}</span></div>))}
                        </div>
                      </div>
                    </div>
                    <div className="gc-note">
                      <div className="gc-note-label">Message from {p.fromName}</div>
                      <div className="gc-note-body">{p.message}</div>
                    </div>
                    {!isOpen(d) ? (
                      <div className="gc-res" style={{ background: r.bg, color: r.fg }}>{r.label}</div>
                    ) : (
                      <div className="gc-proposal-actions">
                        <Button variant="primary" onClick={() => decide(p.id, 'ACCEPT', 'accepted', `${p.fromName} has been told. They will speak to the other manager — no contact details move yet.`)}>আগ্রহী · We are interested</Button>
                        <Button variant="outline" onClick={() => { setShown((s) => ({ ...s, [p.id]: true })); say('Shared with the candidate. They see the biodata and can say yes or no without giving a reason.'); }}>Show my daughter first</Button>
                        <Button variant="ghost" onClick={() => decide(p.id, 'DECLINE', 'declined', 'Declined politely. The other family is told only that it was not the right fit.')}>Not now</Button>
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
                <div className="gc-sealed-body">Sealed when submitted. Not readable by your ghotok, the other family, or SongiSathi.</div>
                {photoRequest && (
                  <div className="gc-photo-req">
                    <div className="gc-photo-req-t">Photo request · {photoRequest.fromName}</div>
                    <div className="gc-photo-req-actions">
                      <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => decide(photoRequest.id, 'ACCEPT', 'accepted', 'Photo released for this one proposal. It is not added to the biodata or the pool.')}>Release for this one</Button>
                      <Button variant="outline" size="sm" onClick={() => decide(photoRequest.id, 'DECLINE', 'declined', 'Not released. The other family is told only that the photo is on request.')}>Not yet</Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="gc-card">
                <div className="gc-card-t">Activity</div>
                <div className="gc-activity">
                  {activity.length === 0 && <div className="gc-activity-text">No activity yet.</div>}
                  {activity.map((ac, i) => (<div key={i}><div className="gc-activity-text">{ac.text}</div><div className="gc-activity-when">{ac.when}</div></div>))}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* candidate */}
        {role === 'CANDIDATE' && (
        <div className="gc-candidate">
          <div className="gc-cand-head">
            <div className="gc-cand-status"><span>9:41</span><span>4G · 78%</span></div>
            <div className="gc-cand-bn">{(profile?.name || '').split(' ')[0] || ''}, আসসালামু আলাইকুম</div>
            <div className="gc-cand-sub">{decisionable.length} proposal{decisionable.length === 1 ? '' : 's'} from your family{selfManaged ? ' — your decision' : ', worth a look'}.</div>
          </div>
          <div className="gc-cand-body">
            {loading && <div className="gc-cand-card">Loading…</div>}
            {!loading && !profile && <div className="gc-cand-card">No profile is linked to your account yet.</div>}
            {!loading && profile && decisionable.length === 0 && <div className="gc-cand-card">No proposals yet.</div>}
            {decisionable.map((p) => {
              const d = p.status; const r = CRES[d];
              return (
                <div key={p.id} className="gc-cand-card">
                  <div className="gc-cand-top">
                    <div className="gc-photo sm"><div className="gc-photo-bg" style={{ filter: 'blur(5px)' }} /><div className="gc-photo-lock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg></div></div>
                    <div className="gc-cand-info">
                      <div className="gc-cand-name">{p.theirName}</div>
                      <div className="gc-cand-meta">{p.theirMeta}</div>
                      <div className="gc-cand-shared">{selfManaged ? `From ${p.fromName}` : 'Shared with you by your family'}</div>
                    </div>
                  </div>
                  {!isOpen(d) ? (
                    <div className="gc-res" style={{ background: r.bg, color: r.fg }}>{r.label}</div>
                  ) : selfManaged ? (
                    <div className="gc-cand-actions">
                      <div className="gc-cand-yes" onClick={() => decide(p.id, 'ACCEPT', 'accepted', 'Recorded. The manager on the other side will be told you are interested.')}>ভালো লেগেছে</div>
                      <div className="gc-cand-no" onClick={() => decide(p.id, 'DECLINE', 'declined', 'Declined. No reason was recorded and none will be asked for.')}>আগ্রহী নই</div>
                    </div>
                  ) : (
                    <div className="gc-cand-shared">Your guardian is reviewing this.</div>
                  )}
                </div>
              );
            })}
            <div className="gc-cand-note">
              <div className="gc-cand-note-t">Saying no costs you nothing</div>
              <div className="gc-cand-note-b">A “not interested” is passed on as a family decision, with no reason attached and no note about you. Your mother sees the count, not your reasoning.</div>
            </div>
            {!loading && !selfManaged && (
              <div className="gc-cannot">
                <div className="gc-cannot-t">What you cannot do here</div>
                <div className="gc-cannot-list">
                  {CANNOT.map((cn) => (<div key={cn} className="gc-cannot-item"><span className="gc-cannot-dot">–</span><span>{cn}</span></div>))}
                </div>
                <div className="gc-cannot-note">Search, messaging, and contact details sit with your guardian and ghotok. This is the product working as intended, not a limitation of your account.</div>
              </div>
            )}
            {!loading && selfManaged && (
              <div className="gc-cannot">
                <div className="gc-cannot-t">Your profile is self-managed</div>
                <div className="gc-cannot-note">You decide for yourself — search the network, edit your own biodata, and review AI matches from the menu above. Contact details still stay sealed until both sides agree to release them.</div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {toast && (<div className="gc-toast"><span className="gc-toast-check">✓</span><span>{toast}</span></div>)}
    </PageFrame>
  );
}
