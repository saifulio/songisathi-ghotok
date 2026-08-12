import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Tabs, Dialog } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './AdminModeration.css';

const V_RES = { approved: { label: 'Approved — gold seal issued, ghotok notified', bg: 'var(--green-100)', fg: 'var(--brand-primary)' }, more: { label: 'Asked for a clearer photograph — awaiting reply', bg: 'var(--gold-100)', fg: 'var(--gold-700)' }, rejected: { label: 'Rejected — reason recorded, account closed', bg: 'var(--red-100)', fg: 'var(--red-700)' } };
const R_RES = { suspended: { label: 'Suspended · both families notified, profiles paused', bg: 'var(--red-100)', fg: 'var(--red-700)' }, warned: { label: 'Warning sent to the manager', bg: 'var(--gold-100)', fg: 'var(--gold-700)' }, dismissed: { label: 'Closed with no action', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' } };
const P_RES = { confirmed: { label: 'Confirmed', bg: 'var(--green-100)', fg: 'var(--brand-primary)' }, flagged: { label: 'Not found', bg: 'var(--red-100)', fg: 'var(--red-700)' } };

const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function AdminModeration() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState('verify');
  const [VERIFY, setVERIFY] = useState([]);
  const [REPORTS, setREPORTS] = useState([]);
  const [PAYMENTS, setPAYMENTS] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Load the three queues. Each row's own `status` field is the source of
  // truth (null = still open) — no separate local override map.
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    Promise.all([api.adminVerifications(token), api.adminReports(token), api.adminPayments(token)])
      .then(([v, r, p]) => {
        if (!live) return;
        setVERIFY(v.verifications);
        setREPORTS(r.reports);
        setPAYMENTS(p.payments);
      })
      .catch((e) => say(e.message || 'Could not load the moderation queues.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, say]);

  const pendingV = VERIFY.filter((v) => !v.status).length;
  const openReports = REPORTS.filter((r) => !r.status);
  const pendingR = openReports.length;
  const seriousOpen = openReports.filter((r) => r.severity === 'Serious').length;
  const openPayments = PAYMENTS.filter((p) => !p.status);
  const pendingP = openPayments.length;
  const owed = openPayments.reduce((n, p) => n + Number(p.amount.replace(/[^0-9]/g, '')), 0);
  const flagged = PAYMENTS.filter((p) => p.status === 'flagged').length;

  // Optimistic decision, reverted on error.
  const decide = async (list, setList, id, apiCall, decision, localStatus, successMsg) => {
    const prev = list;
    setList((rows) => rows.map((x) => (x.id === id ? { ...x, status: localStatus } : x)));
    setDialog(null);
    try {
      const result = await apiCall(token, id, { decision });
      say(typeof successMsg === 'function' ? successMsg(result) : successMsg);
    } catch (e) {
      setList(prev);
      say(e.message || 'Could not record that decision.');
    }
  };

  const strip = [
    { label: 'Awaiting verification', value: String(pendingV), note: 'ghotoks', fg: 'var(--text-primary)' },
    { label: 'Open reports', value: String(pendingR), note: pendingR === 0 ? 'queue clear' : seriousOpen ? `${seriousOpen} serious` : 'none serious', fg: seriousOpen ? 'var(--terracotta-600)' : 'var(--text-primary)' },
    { label: 'Payments to match', value: String(pendingP), note: pendingP === 0 ? (flagged ? `${flagged} to chase` : 'all matched') : `৳${owed.toLocaleString('en-US')} total`, fg: 'var(--text-primary)' },
    { label: 'Median decision time', value: '6h', note: 'target is 24h', fg: 'var(--brand-primary)' },
  ];
  const tabs = [{ value: 'verify', label: 'Verification', count: pendingV }, { value: 'reports', label: 'Reports', count: pendingR }, { value: 'payments', label: 'Payments', count: pendingP }];
  const queueNote = { verify: 'Oldest first · a ghotok waiting on a seal cannot appear in the trusted pool', reports: 'Serious first · nothing here requires opening a sealed section', payments: 'Matched against the merchant statement by hand' }[tab];

  const dlg = dialog ? {
    title: 'Suspend this ghotok?',
    body: `Suspension pauses all ${dialog.count} profile${dialog.count === 1 ? '' : 's'} this manager holds and notifies every family currently mid-proposal. They keep read access to their book so nothing is lost.`,
    actions: (
      <>
        <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => decide(
            REPORTS, setREPORTS, dialog.id, api.updateReport, 'SUSPEND', 'suspended',
            (result) => `Suspended. ${result.affectedProfileCount} profile${result.affectedProfileCount === 1 ? '' : 's'} paused; the manager has been told their account is under review.`
          )}
        >
          Suspend
        </Button>
      </>
    ),
  } : null;

  return (
    <div className="ad">
      <div className="ad-frame">
        <div className="ad-topbar">
          <div className="ad-topbar-brand">
            <div className="ad-logo">স</div>
            <span>SongiSathi</span>
            <span className="ad-badge">ADMIN</span>
          </div>
          <span className="ad-topbar-note">Internal · every action is logged against your account</span>
          <div className="ad-topbar-right"><span>{user?.fullName || ''} · moderator</span><Avatar initials={initialsOf(user?.fullName)} size={28} /></div>
        </div>

        <div className="ad-strip">
          {strip.map((k) => (
            <div key={k.label} className="ad-strip-item">
              <div className="ad-strip-label">{k.label}</div>
              <div className="ad-strip-val"><span style={{ color: k.fg }}>{k.value}</span><span className="ad-strip-note">{k.note}</span></div>
            </div>
          ))}
        </div>

        <div className="ad-body">
          <div className="ad-tabs-row">
            <Tabs items={tabs} active={tab} onChange={setTab} />
            <span className="ad-queue-note">{queueNote}</span>
          </div>

          {tab === 'verify' && (
            <div className="ad-list">
              {loading && <div className="ad-card">Loading…</div>}
              {!loading && VERIFY.length === 0 && <div className="ad-card">No verification requests.</div>}
              {VERIFY.map((v) => {
                const st = v.status; const r = V_RES[st]; const clean = v.checks.every((c) => c.ok);
                return (
                  <div key={v.id} className="ad-card" style={{ borderColor: clean ? 'var(--border-subtle)' : 'var(--gold-300)' }}>
                    <div className="ad-v-top">
                      <Avatar initials={v.init} size={44} />
                      <div className="ad-v-info">
                        <div className="ad-v-name-row">
                          <span className="ad-v-name">{v.name}</span>
                          <span className="ad-v-id">{v.gid}</span>
                          <Badge tone={clean ? 'success' : 'warning'}>{clean ? 'All checks passed' : 'Needs a closer look'}</Badge>
                        </div>
                        <div className="ad-v-meta">{v.meta}</div>
                        <div className="ad-checks">
                          {v.checks.map((c) => (
                            <div key={c.label} className="ad-check" style={{ background: c.ok ? 'var(--green-100)' : 'var(--gold-100)', borderColor: c.ok ? 'var(--green-300)' : 'var(--gold-300)' }}>
                              <div className="ad-check-head">
                                <span className="ad-check-dot" style={{ background: c.ok ? 'var(--brand-primary)' : 'var(--gold-600)', color: c.ok ? 'var(--text-on-brand)' : 'var(--brown-900)' }}>{c.ok ? '✓' : '!'}</span>
                                <span>{c.label}</span>
                              </div>
                              <div className="ad-check-note">{c.note}</div>
                            </div>
                          ))}
                        </div>
                        <div className="ad-v-note">{v.note}</div>
                      </div>
                    </div>
                    {st ? (
                      <div className="ad-res" style={{ background: r.bg, color: r.fg }}>{r.label}</div>
                    ) : (
                      <div className="ad-actions">
                        <Button variant="primary" onClick={() => decide(VERIFY, setVERIFY, v.id, api.updateVerification, 'APPROVE', 'approved', `${v.name} approved. The gold seal is live and their profiles enter the trusted pool tonight.`)}>Approve · issue gold seal</Button>
                        <Button variant="outline" onClick={() => decide(VERIFY, setVERIFY, v.id, api.updateVerification, 'MORE_INFO', 'more', `Asked ${v.name.split(' ')[0]} for a clearer photograph. Nothing else about the application changes.`)}>Ask for a clearer scan</Button>
                        <Button variant="ghost" onClick={() => decide(VERIFY, setVERIFY, v.id, api.updateVerification, 'REJECT', 'rejected', 'Rejected with a written reason. The account is deactivated; nothing is deleted.')}>Reject</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'reports' && (
            <div className="ad-reports">
              <div className="ad-reports-list">
                {loading && <div className="ad-card">Loading…</div>}
                {!loading && REPORTS.length === 0 && <div className="ad-card">No reports.</div>}
                {REPORTS.map((r) => {
                  const st = r.status; const res = R_RES[st];
                  return (
                    <div key={r.id} className="ad-card" style={{ borderColor: r.tone === 'error' ? 'var(--red-500)' : 'var(--border-subtle)' }}>
                      <div className="ad-r-top">
                        <span className="ad-r-title">{r.title}</span>
                        <span className="ad-r-subject">{r.subject}</span>
                        <span style={{ marginLeft: 'auto' }}><Badge tone={r.tone}>{r.severity}</Badge></span>
                      </div>
                      <div className="ad-r-by">Reported by {r.by} · {r.when}</div>
                      <div className="ad-r-body">{r.body}</div>
                      <div className="ad-r-evidence">{r.evidence.map((ev) => (<span key={ev} className="ad-r-tag">{ev}</span>))}</div>
                      {st ? (
                        <div className="ad-res" style={{ background: res.bg, color: res.fg }}>{res.label}</div>
                      ) : (
                        <div className="ad-actions">
                          <Button variant="primary" onClick={() => setDialog({ id: r.id, count: r.affectedProfileCount })}>Suspend and notify</Button>
                          <Button variant="outline" onClick={() => decide(REPORTS, setREPORTS, r.id, api.updateReport, 'WARN', 'warned', 'Warning sent. A second warning within six months triggers automatic suspension.')}>Warn the manager</Button>
                          <Button variant="ghost" onClick={() => decide(REPORTS, setREPORTS, r.id, api.updateReport, 'DISMISS', 'dismissed', 'Closed with no action. The reporter is told a decision was made, not what it was.')}>No action needed</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="ad-reports-rail">
                <div className="ad-cannot">
                  <div className="ad-cannot-head">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                    <span>What you cannot open</span>
                  </div>
                  <div className="ad-cannot-list">
                    {['The private screening answers of any profile', 'Released photographs — only the release log', 'Message content between managers', 'Phone numbers, unless a report names one'].map((cs) => (
                      <div key={cs} className="ad-cannot-item"><span className="ad-cannot-dot">–</span><span>{cs}</span></div>
                    ))}
                  </div>
                  <div className="ad-cannot-note">A report can be judged on behaviour and metadata alone. If it cannot, it is escalated to a two-person review — never resolved by opening the vault, because that door does not exist.</div>
                </div>
                <div className="ad-week">
                  <div className="ad-week-t">This week</div>
                  <div className="ad-week-list">
                    {[{ k: 'Reports resolved', v: '14' }, { k: 'Ghotoks verified', v: '6' }, { k: 'Accounts suspended', v: '1' }, { k: 'Escalated to two-person review', v: '2' }].map((ws) => (
                      <div key={ws.k} className="ad-week-row"><span>{ws.k}</span><span className="ad-week-v">{ws.v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="ad-payments">
              <div className="ad-pay-note">
                <div>
                  <div className="ad-pay-note-t">Payments are matched by hand, on purpose</div>
                  <div className="ad-pay-note-b">Ghotoks send to the merchant number and enter the transaction ID. A person confirms it against the bKash statement — no card details ever enter the product.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => say('Opening today’s bKash merchant statement — 12 incoming, 5 unmatched.')}>Open today’s statement</Button>
              </div>
              <div className="ad-pay-table-wrap">
                <div className="ad-pay-table">
                  <div className="ad-pay-thead"><span>Ghotok</span><span>Transaction ID</span><span>Method</span><span>Amount</span><span>Tier</span><span style={{ textAlign: 'right' }}>Action</span></div>
                  {loading && <div className="ad-pay-row">Loading…</div>}
                  {!loading && PAYMENTS.length === 0 && <div className="ad-pay-row">No payments to match.</div>}
                  {PAYMENTS.map((p) => {
                    const st = p.status; const r = P_RES[st];
                    return (
                      <div key={p.id} className="ad-pay-row">
                        <div className="ad-pay-cell" data-label="Ghotok"><div className="ad-pay-name">{p.name}</div><div className="ad-pay-sub">{p.gid} · {p.when}</div></div>
                        <span className="ad-pay-txn" data-label="Txn">{p.txn}</span>
                        <span className="ad-pay-method" data-label="Method" style={{ color: p.method === 'bKash' ? 'var(--terracotta-600)' : p.method === 'Nagad' ? 'var(--terracotta-700)' : 'var(--brand-primary)' }}>{p.method}</span>
                        <span className="ad-pay-amt" data-label="Amount">{p.amount}</span>
                        <span className="ad-pay-tier" data-label="Tier">{p.tier}</span>
                        <div className="ad-pay-action">
                          {st ? (
                            <span className="ad-pay-res" style={{ background: r.bg, color: r.fg }}>{r.label}</span>
                          ) : (
                            <>
                              <Button variant="primary" size="sm" onClick={() => decide(PAYMENTS, setPAYMENTS, p.id, api.updatePayment, 'CONFIRMED', 'confirmed', `${p.name}’s ${p.tier} plan is active for the month. Receipt sent by SMS.`)}>Confirm</Button>
                              <Button variant="ghost" size="sm" onClick={() => decide(PAYMENTS, setPAYMENTS, p.id, api.updatePayment, 'FLAGGED', 'flagged', `Marked not found. ${p.name.split(' ')[0]} is asked to re-check the transaction ID — no account change yet.`)}>Not found</Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!dlg} title={dlg ? dlg.title : ''} actions={dlg ? dlg.actions : null}>{dlg ? dlg.body : ''}</Dialog>

      {toast && (<div className="ad-toast"><span className="ad-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
