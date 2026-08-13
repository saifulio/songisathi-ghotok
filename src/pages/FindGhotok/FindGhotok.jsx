// Find a matchmaker: the directory of ghotoks a family can approach, nearest
// district first, and the request that asks one of them to take the profile on
// for the fee they publish.
//
// A family running its own search is the free path and stays the free path —
// this page is for the household that would rather hand it to someone who does
// it for a living. Nothing is charged here: the fee is between the family and
// the matchmaker, and the request only says what it is.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Input, Select, Dialog } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMyProfiles } from '../../context/MyProfilesContext.jsx';
import { api } from '../../lib/api.js';
import './FindGhotok.css';

const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`;

const REQUEST_STATE = {
  pending: { label: 'Waiting on them', tone: 'pending' },
  accepted: { label: 'They took it on', tone: 'success' },
  declined: { label: 'They declined', tone: 'neutral' },
  withdrawn: { label: 'You withdrew this', tone: 'neutral' },
};

export default function FindGhotok() {
  const { token } = useAuth();
  // Which profile is being handed over — the one the switcher is on. A
  // guardian with a daughter and a nephew hires per person, not per household.
  const { activeId } = useMyProfiles();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('Any district');
  const [asking, setAsking] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 5200); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const load = useCallback(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.ghotokDirectory(token, { profileId: activeId })
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) say(e.message || 'Could not load the matchmaker directory.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, activeId, say]);
  useEffect(load, [load]);

  const all = data?.ghotoks || [];
  // Filtering is client-side, as it is on the other search pages: the whole
  // directory is small enough to hold, and typing shouldn't cost a round trip.
  const list = all.filter((g) => {
    if (district !== 'Any district' && g.district !== district) return false;
    const query = q.trim().toLowerCase();
    if (query && !`${g.name} ${g.bureauName || ''} ${g.code} ${g.district}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const nearbyCount = all.filter((g) => g.nearby).length;
  const pending = all.map((g) => g.request).find((r) => r && r.status === 'pending') || null;
  const managed = data?.managerType === 'GHOTOK';
  const canRequest = Boolean(data?.canRequest);

  const send = async () => {
    if (busy || !asking) return;
    setBusy(true);
    try {
      await api.requestGhotok(token, { ghotokId: asking.id, message: note.trim() || undefined, profileId: activeId });
      setAsking(null);
      setNote('');
      say(`Sent to ${asking.name}. They decide whether to take it on — nothing changes until they do.`);
      load();
    } catch (e) {
      say(e.message || 'Could not send that request.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (request) => {
    try {
      await api.withdrawGhotokRequest(token, request.id, activeId);
      say('Withdrawn. You can ask someone else now.');
      load();
    } catch (e) {
      say(e.message || 'Could not withdraw that request.');
    }
  };

  return (
    <div className="fg">
      <div className="fg-frame">
        <div className="fg-head">
          <div>
            <div className="fg-h-bn">ঘটক খুঁজুন</div>
            <div className="fg-h-sub">
              Matchmakers taking families on, nearest to you first. What each asks is published below —
              the fee is paid to them, not to SongiSathi, and only after they agree to take the profile on.
            </div>
          </div>
          {data?.homeDistrict && (
            <Badge tone="neutral">{nearbyCount} in {data.homeDistrict}</Badge>
          )}
        </div>

        {!loading && managed && (
          <div className="fg-banner">
            A matchmaker already runs this profile. Ask them to release it before approaching anyone else —
            two managers on one biodata is how a family ends up owing two fees.
          </div>
        )}
        {!loading && !canRequest && !managed && (
          <div className="fg-banner">
            Your manager chooses a matchmaker on your behalf. You can read who is out there here, and show
            them anyone worth approaching.
          </div>
        )}
        {!loading && pending && (
          <div className="fg-banner gold">
            <span>
              You asked <strong>{pending.ghotokName}</strong> {pending.when.toLowerCase()} and are waiting on an answer.
              One request at a time, so a second matchmaker cannot say yes to the same profile.
            </span>
            {canRequest && <Button variant="ghost" size="sm" onClick={() => withdraw(pending)}>Withdraw it</Button>}
          </div>
        )}

        <div className="fg-filters">
          <div className="fg-filter-search">
            <Input placeholder="নাম, ব্যুরো, কোড · Search name, bureau, code" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select
            label=""
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            options={['Any district', ...(data?.districts || [])].map((d) => ({ value: d, label: d }))}
          />
        </div>

        {loading && <div className="fg-empty"><div className="fg-empty-t">Loading matchmakers…</div></div>}
        {!loading && list.length === 0 && (
          <div className="fg-empty">
            <div className="fg-empty-t">No matchmaker matches that</div>
            <div className="fg-empty-b">Try a wider district, or clear the search.</div>
          </div>
        )}

        <div className="fg-cards">
          {list.map((g) => {
            const req = g.request;
            const state = req ? REQUEST_STATE[req.status] : null;
            return (
              <div key={g.id} className={`fg-card ${g.nearby ? 'nearby' : ''}`}>
                <div className="fg-card-top">
                  <Avatar initials={g.init} size={42} />
                  <div className="fg-card-id">
                    <div className="fg-card-name-row">
                      <span className="fg-card-name">{g.name}</span>
                      {g.verified && <Badge tone="gold">Verified</Badge>}
                      {g.nearby && <Badge tone="success">Nearby</Badge>}
                    </div>
                    <div className="fg-card-meta">{[g.bureauName || `${g.tier} matchmaker`, g.district, g.code].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="fg-card-fee">
                    <div className="fg-card-fee-num">{g.serviceFee > 0 ? taka(g.serviceFee) : 'On asking'}</div>
                    <div className="fg-card-fee-cap">{g.serviceFee > 0 ? 'to take a profile on' : 'no published fee'}</div>
                  </div>
                </div>

                <div className="fg-card-stats">
                  <div className="fg-stat"><span className="fg-stat-v">{g.marriagesClosed}</span><span className="fg-stat-k">marriages closed</span></div>
                  <div className="fg-stat"><span className="fg-stat-v">{g.yearsActive}</span><span className="fg-stat-k">years matchmaking</span></div>
                  <div className="fg-stat"><span className="fg-stat-v">{g.profilesManaged}</span><span className="fg-stat-k">families carried now</span></div>
                  <div className="fg-stat"><span className="fg-stat-v">{g.memberSince}</span><span className="fg-stat-k">on SongiSathi since</span></div>
                </div>

                <div className="fg-card-foot">
                  {state ? (
                    <>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      <span className="fg-card-foot-note">
                        {req.status === 'declined' && req.declineReason
                          ? `They said: “${req.declineReason}”.`
                          : req.status === 'accepted'
                            ? `Agreed at ${taka(req.fee)}. They run this profile now.`
                            : req.status === 'pending'
                              ? `Asked ${req.when.toLowerCase()} at ${taka(req.fee)}.`
                              : 'You withdrew this request.'}
                      </span>
                      {req.status === 'pending' && canRequest && (
                        <Button variant="ghost" size="sm" onClick={() => withdraw(req)}>Withdraw</Button>
                      )}
                    </>
                  ) : g.full ? (
                    <span className="fg-card-foot-note">Their book is full this season — they could not take another profile today.</span>
                  ) : (
                    <>
                      <span className="fg-card-foot-note">
                        They see your biodata and decide. Nothing moves, and nothing is owed, until they accept.
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!canRequest || managed || Boolean(pending)}
                        onClick={() => { setAsking(g); setNote(''); }}
                      >
                        দায়িত্ব দিন · Ask them to manage
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={Boolean(asking)}
        title={asking ? `Ask ${asking.name} to manage this profile?` : ''}
        actions={(
          <>
            <Button variant="ghost" onClick={() => setAsking(null)}>Cancel</Button>
            <Button variant="primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send the request'}</Button>
          </>
        )}
      >
        {asking && (
          <>
            <div className="fg-dlg-note">
              If they accept, {asking.name} becomes this profile's matchmaker: proposals route through them,
              and the fee of {asking.serviceFee > 0 ? taka(asking.serviceFee) : 'whatever they quote you'} is
              settled between you and them. SongiSathi takes nothing from it and holds nothing on your behalf.
            </div>
            <Input
              label="A note for them"
              caption="optional"
              placeholder="What you are looking for, and why you are asking them."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </>
        )}
      </Dialog>

      {toast && (<div className="fg-toast"><span className="fg-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
