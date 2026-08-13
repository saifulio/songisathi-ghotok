// Management requests: families asking this matchmaker to take their profile
// on, for the fee published in the directory.
//
// Separate from the interest inbox on purpose. An interest is about a match
// between two candidates; this is about who runs a biodata. Accepting adds the
// profile to the book and spends a place on the plan, so the meter is on the
// page next to the decision rather than a surprise afterwards.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Tabs, Dialog, Radio, Input } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './ManagementRequests.css';

const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`;

const REASONS = [
  'My book is full this season',
  'This family is outside the districts I work',
  'I do not have suitable candidates on the other side',
  'The biodata needs finishing before I could work from it',
];

const STATE = {
  pending: { label: 'Awaiting you', tone: 'pending' },
  accepted: { label: 'Taken on', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn by the family', tone: 'neutral' },
};

export default function ManagementRequests() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 5200); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const load = useCallback(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.ghotokRequestInbox(token)
      .then((d) => { if (!live) return; setItems(d.requests); setPlan(d.plan); })
      .catch((e) => { if (live) say(e.message || 'Could not load your requests.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, say]);
  useEffect(load, [load]);

  // Not optimistic: accepting moves a profile between books and can be refused
  // by the plan limit, so the row is only redrawn once the server has agreed.
  const decide = async (id, status, declineReason, successMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      const { request } = await api.decideGhotokRequest(token, id, { status, ...(declineReason ? { declineReason } : {}) });
      setItems((list) => list.map((it) => (it.id === id ? request : it)));
      setDeclining(null);
      say(successMsg);
      // The plan meter moved if this was an acceptance.
      if (status === 'ACCEPTED') load();
    } catch (e) {
      say(e.message || 'Could not answer that request.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = items.filter((it) => {
    if (tab === 'pending') return it.status === 'pending';
    if (tab === 'accepted') return it.status === 'accepted';
    if (tab === 'closed') return it.status === 'declined' || it.status === 'withdrawn';
    return true;
  });
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const tabs = [
    { value: 'pending', label: 'Awaiting you', count: pendingCount },
    { value: 'accepted', label: 'Taken on', count: items.filter((i) => i.status === 'accepted').length },
    { value: 'closed', label: 'Closed', count: items.filter((i) => ['declined', 'withdrawn'].includes(i.status)).length },
    { value: 'all', label: 'All', count: items.length },
  ];
  const planFull = plan && plan.used >= plan.limit;
  const chosenReason = reason === 'Other' ? other.trim() : reason;

  return (
    <div className="mr">
      <div className="mr-frame">
        <div className="mr-head">
          <div>
            <div className="mr-h-bn">দায়িত্বের অনুরোধ</div>
            <div className="mr-h-sub">
              Families who found you in the directory and are asking you to run their profile. Accepting
              adds the biodata to your book at the fee you publish — the money is settled between you and
              the family, and SongiSathi is not part of it.
            </div>
          </div>
          {plan && (
            <div className="mr-plan">
              <div className="mr-plan-num">{plan.used} / {plan.limit}</div>
              <div className="mr-plan-cap">active profiles on your {plan.tier.toLowerCase()} plan</div>
            </div>
          )}
        </div>

        {planFull && pendingCount > 0 && (
          <div className="mr-banner">
            Your plan is full, so accepting would be refused. Free a place first, or upgrade — a family
            waiting on an answer would rather have a decline than silence.
          </div>
        )}

        <Tabs items={tabs} active={tab} onChange={setTab} />

        {loading && <div className="mr-empty"><div className="mr-empty-t">Loading…</div></div>}
        {!loading && filtered.length === 0 && (
          <div className="mr-empty">
            <div className="mr-empty-t">Nothing in this view</div>
            <div className="mr-empty-b">
              When a family asks you to take their profile on, it arrives here. Your published fee
              {plan ? ` is ${plan.serviceFee > 0 ? taka(plan.serviceFee) : 'not set — families are told to ask you'}` : ''}.
            </div>
          </div>
        )}

        <div className="mr-cards">
          {filtered.map((it) => {
            const st = STATE[it.status] || { label: it.status, tone: 'neutral' };
            return (
              <div key={it.id} className="mr-card">
                <div className="mr-card-top">
                  <Avatar initials={it.profileInit} size={42} tone="secondary" />
                  <div className="mr-card-id">
                    <div className="mr-card-name-row">
                      <span className="mr-card-name">{it.profileName}</span>
                      <span className="mr-card-prn">{it.profilePrn || 'no PRN yet'}</span>
                    </div>
                    <div className="mr-card-meta">{it.profileMeta}</div>
                    <div className="mr-card-asked">Asked by {it.askedBy} · {it.when}</div>
                  </div>
                  <div className="mr-card-fee">
                    <div className="mr-card-fee-num">{it.fee > 0 ? taka(it.fee) : 'On asking'}</div>
                    <div className="mr-card-fee-cap">agreed when they asked</div>
                  </div>
                </div>

                {it.message && <div className="mr-message">{it.message}</div>}

                <div className="mr-card-foot">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="mr-card-foot-note">
                    {it.status === 'pending'
                      ? `Biodata ${it.profileCompleteness}% complete · currently ${it.profileManagerType === 'GUARDIAN' ? 'run by the guardian' : 'run by the candidate'}.`
                      : it.status === 'accepted'
                        ? `In your book since ${it.decided ? it.decided.toLowerCase() : 'you accepted'}.`
                        : it.status === 'declined'
                          ? `You told them: “${it.declineReason}”.`
                          : 'The family withdrew this before you answered.'}
                  </span>
                  {it.status === 'pending' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setDeclining(it); setReason(REASONS[0]); setOther(''); }}>Decline</Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy || planFull}
                        onClick={() => decide(it.id, 'ACCEPTED', null, `${it.profileName} is in your book now, at ${it.fee > 0 ? taka(it.fee) : 'the fee you quote them'}.`)}
                      >
                        দায়িত্ব নিন · Take this on
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
        open={Boolean(declining)}
        title="Decline this request?"
        actions={(
          <>
            <Button variant="ghost" onClick={() => setDeclining(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={busy || !chosenReason}
              onClick={() => decide(declining.id, 'DECLINED', chosenReason, `Declined with “${chosenReason.toLowerCase()}”. They can ask someone else now.`)}
            >
              Send decline
            </Button>
          </>
        )}
      >
        {declining && (
          <>
            The family is told your reason and nothing else. They keep running the profile themselves and
            are free to approach another matchmaker straight away.
            <div className="mr-reasons">
              {[...REASONS, 'Other'].map((r) => (
                <div
                  key={r}
                  className="mr-reason"
                  onClick={() => setReason(r)}
                  style={{ borderColor: reason === r ? 'var(--brand-primary)' : 'var(--border-subtle)', background: reason === r ? 'var(--green-100)' : 'var(--surface-page)' }}
                >
                  <Radio label={r} checked={reason === r} name="mr-decline-reason" onChange={() => setReason(r)} />
                </div>
              ))}
              {reason === 'Other' && (
                <Input placeholder="In your own words — they see this." value={other} onChange={(e) => setOther(e.target.value)} />
              )}
            </div>
          </>
        )}
      </Dialog>

      {toast && (<div className="mr-toast"><span className="mr-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
