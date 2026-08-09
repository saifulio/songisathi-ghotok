import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Tabs, StatusPill, Badge, Dialog, Radio } from '../../components/ui/index.jsx';
import './InterestInbox.css';

const ITEMS = [
  { id: 'i1', kind: 'interest', init: 'KI', fromName: 'Kamrul Islam', fromMeta: 'GHT-0311 · Sylhet bureau', when: '2 hours ago', score: 84,
    theirName: 'Sumaiya Haque', theirPrn: 'PRN-20881', theirMeta: '24 · BSc Pharmacy, SUST · Zindabazar, Sylhet',
    yourName: 'Tanvir Ahmed', yourPrn: 'PRN-10188', yourMeta: '31 · MSc CSE, BUET · settled in Auckland',
    summary: 'Interest in Tanvir Ahmed on behalf of Sumaiya Haque’s family.',
    message: 'Assalamu alaikum, Rahima apa. Sumaiya’s family has read Tanvir’s biodata carefully and would like to proceed. They are open to their daughter settling abroad, and her father would like to speak with the guardian first, before anything is shown to the young people. Please let me know what suits your side.',
    mgrStats: [{ k: 'Marriages closed', v: '19' }, { k: 'Profiles managed', v: '31' }, { k: 'Member since', v: '2024' }] },
  { id: 'i2', kind: 'photo', init: 'NB', fromName: 'Nazma Begum', fromMeta: 'GHT-0198 · Mymensingh', when: 'Yesterday', score: 71,
    theirName: 'Ayesha Siddika', theirPrn: 'PRN-19077', theirMeta: '23 · Honours in Bangla · Mymensingh Sadar',
    yourName: 'Rezaul Karim', yourPrn: 'PRN-10077', yourMeta: '29 · LLB, Chittagong University · Khulshi',
    summary: 'Photo access request for Rezaul Karim, for one specific proposal.',
    message: 'Apa, the family has asked to see a photograph before taking this further. Only the guardian will see it, and only for this proposal. Please release it if your side is comfortable.',
    mgrStats: [{ k: 'Marriages closed', v: '8' }, { k: 'Profiles managed', v: '17' }, { k: 'Member since', v: '2025' }] },
  { id: 'i3', kind: 'interest', init: 'SA', fromName: 'Guardian — Shirin Akter', fromMeta: 'Self-managed family · Uttara', when: '3 days ago', score: 66,
    theirName: 'Farhana Akter', theirPrn: 'PRN-31204', theirMeta: '27 · BBA, North South · Uttara, Dhaka',
    yourName: 'Imran Chowdhury', yourPrn: 'PRN-10233', yourMeta: '30 · MEng, Toronto · civil engineer',
    summary: 'Interest in Imran Chowdhury, sent directly by the guardian.',
    message: 'We came across Imran’s biodata through the network. Our daughter is in service and intends to continue after marriage — we wanted to say so plainly at the start rather than later.',
    mgrStats: [{ k: 'Profiles managed', v: '1' }, { k: 'Verification', v: 'Pending' }, { k: 'Member since', v: '2026' }] },
  { id: 'i4', kind: 'release', init: 'KI', fromName: 'Kamrul Islam', fromMeta: 'GHT-0311 · Sylhet bureau', when: 'Last week', score: 88,
    theirName: 'Rifat Jahan', theirPrn: 'PRN-24410', theirMeta: '29 · MSc Economics, DU · Chattogram',
    yourName: 'Mahmudul Hasan', yourPrn: 'PRN-10015', yourMeta: '34 · MBBS, Rajshahi Medical · Boalia',
    summary: 'Contact release agreed — both guardians spoke on Friday.',
    message: 'Both families have met once. They would like to exchange numbers now and continue on their own. I have released our side; awaiting yours.',
    mgrStats: [{ k: 'Marriages closed', v: '19' }, { k: 'Profiles managed', v: '31' }, { k: 'Member since', v: '2024' }] },
];

const REASONS = [
  'Not the right fit at this time',
  'The family is considering another proposal',
  'Location expectations do not align',
  'The profile is on hold this season',
];

const KIND = { interest: 'Interest', photo: 'Photo access request', release: 'Contact release' };
const TITLE = { interest: 'Interest received', photo: 'Photo access requested', release: 'Contact release requested' };

export default function InterestInbox() {
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState('i1');
  const [status, setStatus] = useState({ i1: 'pending', i2: 'pending', i3: 'pending', i4: 'accepted' });
  const [declineReason, setDeclineReason] = useState({});
  const [pickedReason, setPickedReason] = useState(REASONS[0]);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 4400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setSt = (id, st, msg) => { setStatus((s) => ({ ...s, [id]: st })); setDialog(null); if (msg) say(msg); };

  const filtered = ITEMS.filter((it) => {
    const st = status[it.id];
    if (tab === 'pending') return st === 'pending';
    if (tab === 'accepted') return st === 'accepted';
    if (tab === 'declined') return st === 'declined' || st === 'expired';
    return true;
  });
  const selRaw = ITEMS.find((it) => it.id === selected) || null;
  const sel = selRaw && filtered.some((i) => i.id === selRaw.id) ? selRaw : filtered[0] || null;
  const st = sel ? status[sel.id] : null;
  const pendingCount = ITEMS.filter((i) => status[i.id] === 'pending').length;

  const tabs = [
    { value: 'pending', label: 'Awaiting you', count: pendingCount },
    { value: 'accepted', label: 'Accepted', count: ITEMS.filter((i) => status[i.id] === 'accepted').length },
    { value: 'declined', label: 'Closed', count: ITEMS.filter((i) => ['declined', 'expired'].includes(status[i.id])).length },
    { value: 'all', label: 'All', count: ITEMS.length },
  ];

  const log = sel ? [
    { text: `Interest sent by ${sel.fromName}`, when: sel.when, dot: 'var(--brand-primary)' },
    { text: 'Screening comparison run — result: compatible', when: 'automatic, same minute', dot: 'var(--gold-600)' },
    { text: 'Biodata viewed by you', when: '1 hour ago', dot: 'var(--border-default)' },
    { text: st === 'pending' ? 'Awaiting your decision' : 'Decision recorded', when: st === 'pending' ? 'expires in 14 days' : 'just now', dot: 'var(--terracotta-600)' },
  ] : [];

  const dlg = dialog === 'decline'
    ? { title: 'Decline this interest?', body: 'Choose what the other manager is told. Your candidate is never named in a decline reason, and the wording stays respectful on both sides.', reasons: true,
        actions: (
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setDeclineReason((p) => ({ ...p, [sel.id]: pickedReason })); setSt(sel.id, 'declined', `Declined with “${pickedReason.toLowerCase()}”. Nothing else was shared.`); }}>Send decline</Button>
          </>
        ) }
    : dialog === 'release'
      ? { title: 'Release contact details?', body: `You are about to share this family’s phone number with ${sel ? sel.fromName : 'the other manager'}, and receive theirs. This cannot be undone, and both families are notified.`,
          actions: (
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>Not yet</Button>
              <Button variant="primary" onClick={() => { setDialog(null); say('Contact released and logged. The families can speak directly now.'); }}>Release</Button>
            </>
          ) }
      : null;

  const resRow = {
    accepted: { label: 'Accepted', bg: 'var(--green-100)', fg: 'var(--brand-primary)' },
    declined: { label: 'Declined', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' },
    expired: { label: 'Held', bg: 'var(--gold-100)', fg: 'var(--gold-700)' },
  };

  return (
    <div className="ib">
      <div className="ib-frame">
        <div className="ib-topbar">
          <div className="ib-topbar-brand"><div className="ib-logo">স</div><span>SongiSathi</span></div>
          <div className="ib-topbar-tabs">
            <span>ড্যাশবোর্ড</span><span>প্রোফাইল</span><span>অনুসন্ধান</span><span className="on">আগ্রহ</span>
          </div>
          <div className="ib-topbar-right">
            <span className="ib-pending-pill">{pendingCount} awaiting you</span>
            <Avatar initials="RA" size={28} />
          </div>
        </div>

        <div className="ib-grid">
          {/* list */}
          <div className="ib-list">
            <div className="ib-list-head">
              <div className="ib-h-bn">আগ্রহের তালিকা</div>
              <div className="ib-h-sub">Interest inbox · every request routes through you</div>
              <Tabs items={tabs} active={tab} onChange={setTab} style={{ marginTop: 12 }} />
            </div>
            <div className="ib-list-scroll">
              {filtered.length === 0 && (
                <div className="ib-empty">
                  <div className="ib-empty-t">Nothing in this view</div>
                  <div className="ib-empty-b">When a manager sends interest in one of your profiles, it will appear here.</div>
                </div>
              )}
              {filtered.map((it) => (
                <div key={it.id} className="ib-item" onClick={() => setSelected(it.id)}
                  style={{ background: sel && sel.id === it.id ? 'var(--surface-page)' : 'transparent', borderLeftColor: sel && sel.id === it.id ? 'var(--brand-primary)' : 'transparent' }}>
                  <Avatar initials={it.init} size={38} />
                  <div className="ib-item-body">
                    <div className="ib-item-top">
                      <span className="ib-item-name">{it.fromName}</span>
                      <span className="ib-item-when">{it.when}</span>
                    </div>
                    <div className="ib-item-meta">{it.fromMeta}</div>
                    <div className="ib-item-summary">{it.summary}</div>
                    <div className="ib-item-foot">
                      <StatusPill status={status[it.id]} />
                      <span className="ib-item-kind">{KIND[it.kind]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* detail */}
          <div className="ib-detail">
            {sel ? (
              <div className="ib-detail-inner">
                <div className="ib-detail-head">
                  <div>
                    <div className="ib-detail-title">{TITLE[sel.kind]}</div>
                    <div className="ib-detail-sub">{sel.fromName} · {sel.fromMeta} · {sel.when}</div>
                  </div>
                  <StatusPill status={st} />
                </div>

                <div className="ib-detail-body">
                  <div className="ib-detail-main">
                    {/* pair */}
                    <div className="ib-card">
                      <div className="ib-card-label">The proposal</div>
                      <div className="ib-pair">
                        <div className="ib-pair-side">
                          <div className="ib-photo locked">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EBDCC3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                          </div>
                          <div>
                            <div className="ib-pair-role">Their candidate</div>
                            <div className="ib-pair-name">{sel.theirName}</div>
                            <div className="ib-pair-prn">{sel.theirPrn}</div>
                            <div className="ib-pair-meta">{sel.theirMeta}</div>
                          </div>
                        </div>
                        <div className="ib-pair-arrow">↔</div>
                        <div className="ib-pair-side">
                          <div className="ib-photo" />
                          <div>
                            <div className="ib-pair-role">Your candidate</div>
                            <div className="ib-pair-name">{sel.yourName}</div>
                            <div className="ib-pair-prn">{sel.yourPrn}</div>
                            <div className="ib-pair-meta">{sel.yourMeta}</div>
                          </div>
                        </div>
                      </div>
                      <div className="ib-screen">
                        <div>
                          <div className="ib-screen-label">Screening result — the only thing that crosses the wall</div>
                          <div className="ib-screen-row">
                            <Badge tone="success">Compatible</Badge>
                            <span>No reason is given, to you or to anyone.</span>
                          </div>
                        </div>
                        <div className="ib-screen-score">
                          <div className="ib-screen-num">{sel.score}%</div>
                          <div className="ib-screen-cap">visible-factor match</div>
                        </div>
                      </div>
                    </div>

                    {/* message */}
                    <div className="ib-card">
                      <div className="ib-card-label">Message from {sel.fromName.replace('Guardian — ', '').split(' ')[0]}</div>
                      <div className="ib-message">{sel.message}</div>
                      <div className="ib-message-foot">Sent {sel.when.toLowerCase()} · manager to manager. Neither family has been shown this yet.</div>
                    </div>

                    {/* decision */}
                    {st === 'pending' && (
                      <div className="ib-card">
                        <div className="ib-decision-t">Your decision</div>
                        <div className="ib-decision-b">Take it to the family first if you need to — nothing expires for 14 days, and the other manager sees only “under consideration”.</div>
                        <div className="ib-decision-actions">
                          <Button variant="primary" onClick={() => setSt(sel.id, 'accepted', `Accepted. ${sel.fromName} has been told the family will see the proposal.`)}>পরিবারকে দেখান · Accept and show the family</Button>
                          <Button variant="outline" onClick={() => setDialog('decline')}>Decline politely</Button>
                          <Button variant="ghost" onClick={() => setSt(sel.id, 'expired', 'Held for a week. The other manager sees only “under consideration”.')}>Hold for a week</Button>
                        </div>
                      </div>
                    )}
                    {st === 'accepted' && (
                      <div className="ib-card accepted">
                        <div className="ib-decision-t" style={{ color: 'var(--brand-primary)' }}>Accepted — the families can now be introduced</div>
                        <div className="ib-decision-b">Contact details are still sealed. Releasing them is a separate step and both managers must agree.</div>
                        <div className="ib-decision-actions">
                          <Button variant="primary" onClick={() => setDialog('release')}>Release contact details</Button>
                          <Button variant="outline" onClick={() => say('Guardian call suggested for Friday 7pm. Both managers will confirm before any number is shared.')}>Arrange a guardian call</Button>
                        </div>
                      </div>
                    )}
                    {(st === 'declined' || st === 'expired') && (
                      <div className="ib-card">
                        <div className="ib-decision-t">{st === 'declined' ? 'Declined' : 'Held for a week'}</div>
                        <div className="ib-decision-b">{declineReason[sel.id] ? `The other manager was told: “${declineReason[sel.id]}”. Nothing else was shared.` : 'Held for a week — the other manager sees only that it is under consideration.'}</div>
                      </div>
                    )}
                  </div>

                  {/* rail */}
                  <div className="ib-rail">
                    <div className="ib-card">
                      <div className="ib-mgr">
                        <Avatar initials={sel.init} size={34} />
                        <div>
                          <div className="ib-mgr-name">{sel.fromName}</div>
                          <div className="ib-mgr-meta">{sel.fromMeta}</div>
                        </div>
                      </div>
                      <div className="ib-mgr-stats">
                        {sel.mgrStats.map((ms) => (
                          <div key={ms.k} className="ib-mgr-stat"><span>{ms.k}</span><span className="ib-mgr-v">{ms.v}</span></div>
                        ))}
                      </div>
                    </div>

                    <div className="ib-card">
                      <div className="ib-log-t">Activity log</div>
                      <div className="ib-log">
                        {log.map((lg, i) => (
                          <div key={i} className="ib-log-row">
                            <div className="ib-log-rail">
                              <span className="ib-log-dot" style={{ background: lg.dot }} />
                              {i < log.length - 1 && <span className="ib-log-line" />}
                            </div>
                            <div className="ib-log-content">
                              <div className="ib-log-text">{lg.text}</div>
                              <div className="ib-log-when">{lg.when}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ib-card gold">
                      <div className="ib-gold-head">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold-700)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                        <span>Nothing leaks from here</span>
                      </div>
                      <div className="ib-gold-body">Declining tells the other manager only that it was not the right fit. Your candidate's name is never attached to a decline reason.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ib-empty" style={{ margin: 'auto' }}>
                <div className="ib-empty-t">No interest selected</div>
                <div className="ib-empty-b">Pick a request from the list to see the proposal.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!dlg} title={dlg ? dlg.title : ''} actions={dlg ? dlg.actions : null}>
        {dlg && (
          <>
            {dlg.body}
            {dlg.reasons && (
              <div className="ib-reasons">
                {REASONS.map((r) => (
                  <div key={r} className="ib-reason" onClick={() => setPickedReason(r)} style={{ borderColor: pickedReason === r ? 'var(--brand-primary)' : 'var(--border-subtle)', background: pickedReason === r ? 'var(--green-100)' : 'var(--surface-page)' }}>
                    <Radio label={r} checked={pickedReason === r} name="decline-reason" onChange={() => setPickedReason(r)} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Dialog>

      {toast && (
        <div className="ib-toast"><span className="ib-toast-check">✓</span><span>{toast}</span></div>
      )}
    </div>
  );
}
