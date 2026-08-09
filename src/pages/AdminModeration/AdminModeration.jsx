import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Tabs, Dialog } from '../../components/ui/index.jsx';
import './AdminModeration.css';

const VERIFY = [
  { id: 'v1', init: 'KI', name: 'Kamrul Islam', gid: 'GHT-0311', meta: 'Sylhet · applied 6 August · 31 profiles imported',
    note: 'Two existing verified ghotoks in Sylhet have vouched for him. His register photographs show entries going back to 2019.',
    checks: [ { label: 'NID', ok: true, note: 'Front and back legible, name matches' }, { label: 'Photograph', ok: true, note: 'Clear, recent, face visible' }, { label: 'Phone', ok: true, note: 'Verified by OTP, not seen before' }, { label: 'Referrals', ok: true, note: 'Two verified ghotoks vouched' } ] },
  { id: 'v2', init: 'NB', name: 'Nazma Begum', gid: 'GHT-0198', meta: 'Mymensingh · applied 7 August · 17 profiles imported',
    note: 'NID scan is readable but the photograph is a group photo cropped tightly. Ask for a plain one before issuing the seal.',
    checks: [ { label: 'NID', ok: true, note: 'Legible, name matches' }, { label: 'Photograph', ok: false, note: 'Cropped from a group photo' }, { label: 'Phone', ok: true, note: 'Verified by OTP' }, { label: 'Referrals', ok: false, note: 'None yet — first in her district' } ] },
  { id: 'v3', init: 'MR', name: 'Monir Rahman', gid: 'GHT-0402', meta: 'Dhaka · applied 7 August · 4 profiles imported',
    note: 'The phone number was registered to a suspended account in June. Same NID, different name spelling. Do not approve without a call.',
    checks: [ { label: 'NID', ok: false, note: 'Name spelling differs from application' }, { label: 'Photograph', ok: true, note: 'Clear and recent' }, { label: 'Phone', ok: false, note: 'Previously on a suspended account' }, { label: 'Referrals', ok: false, note: 'None' } ] },
];

const REPORTS = [
  { id: 'r1', title: 'Contact details shared outside the platform', subject: 'GHT-0402', severity: 'Serious', tone: 'error', by: 'A guardian in Uttara', when: 'Yesterday', body: 'The guardian says this ghotok passed her daughter’s phone number to another family before any interest was accepted. She has the WhatsApp message.', evidence: ['Screenshot supplied', 'No release logged on the profile', 'Second report this month'] },
  { id: 'r2', title: 'Profile appears to be duplicated', subject: 'PRN-31204', severity: 'Moderate', tone: 'warning', by: 'Automatic check', when: '2 days ago', body: 'The same name, date of birth and district appear under two managers. One is a self-managed guardian, the other a ghotok. Likely a genuine handover rather than fraud.', evidence: ['Matching DOB and district', 'Different phone numbers', 'Both created in the last month'] },
  { id: 'r3', title: 'Photograph does not match the biodata', subject: 'PRN-19077', severity: 'Minor', tone: 'neutral', by: 'A ghotok in Sylhet', when: '4 days ago', body: 'A released photograph appears to be of a different person than described. May simply be an old photograph.', evidence: ['Released once, to one family', 'Manager verified in 2025'] },
];

const PAYMENTS = [
  { id: 'p1', name: 'Kamrul Islam', gid: 'GHT-0311', txn: 'BKS8H2K91M', method: 'bKash', amount: '৳2,000', tier: 'Bureau', when: 'Today 09:12' },
  { id: 'p2', name: 'Nazma Begum', gid: 'GHT-0198', txn: 'NGD4472PLQ', method: 'Nagad', amount: '৳960', tier: 'Solo', when: 'Today 08:40' },
  { id: 'p3', name: 'Shafiqul Alam', gid: 'GHT-0155', txn: 'BKS1120XZT', method: 'bKash', amount: '৳4,000', tier: 'Agency', when: 'Yesterday 21:05' },
  { id: 'p4', name: 'Rokeya Sultana', gid: 'GHT-0287', txn: 'BKS9910AAB', method: 'bKash', amount: '৳2,000', tier: 'Bureau', when: 'Yesterday 19:22' },
  { id: 'p5', name: 'Jashim Uddin', gid: 'GHT-0361', txn: 'RKT5567MNO', method: 'Rocket', amount: '৳960', tier: 'Solo', when: 'Yesterday 17:48' },
];

const V_RES = { approved: { label: 'Approved — gold seal issued, ghotok notified', bg: 'var(--green-100)', fg: 'var(--brand-primary)' }, more: { label: 'Asked for a clearer photograph — awaiting reply', bg: 'var(--gold-100)', fg: 'var(--gold-700)' }, rejected: { label: 'Rejected — reason recorded, account closed', bg: 'var(--red-100)', fg: 'var(--red-700)' } };
const R_RES = { suspended: { label: 'Suspended · both families notified, profiles paused', bg: 'var(--red-100)', fg: 'var(--red-700)' }, warned: { label: 'Warning sent to the manager', bg: 'var(--gold-100)', fg: 'var(--gold-700)' }, dismissed: { label: 'Closed with no action', bg: 'var(--surface-card-alt)', fg: 'var(--text-secondary)' } };
const P_RES = { confirmed: { label: 'Confirmed', bg: 'var(--green-100)', fg: 'var(--brand-primary)' }, flagged: { label: 'Not found', bg: 'var(--red-100)', fg: 'var(--red-700)' } };

export default function AdminModeration() {
  const [tab, setTab] = useState('verify');
  const [vState, setV] = useState({});
  const [rState, setR] = useState({});
  const [pState, setP] = useState({});
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pendingV = VERIFY.filter((v) => !vState[v.id]).length;
  const openReports = REPORTS.filter((r) => !rState[r.id]);
  const pendingR = openReports.length;
  const seriousOpen = openReports.filter((r) => r.severity === 'Serious').length;
  const openPayments = PAYMENTS.filter((p) => !pState[p.id]);
  const pendingP = openPayments.length;
  const owed = openPayments.reduce((n, p) => n + Number(p.amount.replace(/[^0-9]/g, '')), 0);
  const flagged = PAYMENTS.filter((p) => pState[p.id] === 'flagged').length;

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
    body: `Suspension pauses all ${dialog.count} profiles this manager holds and notifies every family currently mid-proposal. They keep read access to their book so nothing is lost.`,
    actions: (<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={() => { setR((st) => ({ ...st, [dialog.id]: 'suspended' })); setDialog(null); say('Suspended. 31 profiles paused, 4 families mid-proposal have been told their ghotok is under review.'); }}>Suspend</Button></>),
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
          <div className="ad-topbar-right"><span>Farah H. · moderator</span><Avatar initials="FH" size={28} /></div>
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
              {VERIFY.map((v) => {
                const st = vState[v.id]; const r = V_RES[st]; const clean = v.checks.every((c) => c.ok);
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
                        <Button variant="primary" onClick={() => { setV((p) => ({ ...p, [v.id]: 'approved' })); say(`${v.name} approved. The gold seal is live and his profiles enter the trusted pool tonight.`); }}>Approve · issue gold seal</Button>
                        <Button variant="outline" onClick={() => { setV((p) => ({ ...p, [v.id]: 'more' })); say(`Asked ${v.name.split(' ')[0]} for a clearer photograph. Nothing else about the application changes.`); }}>Ask for a clearer scan</Button>
                        <Button variant="ghost" onClick={() => { setV((p) => ({ ...p, [v.id]: 'rejected' })); say('Rejected with a written reason. The imported profiles are deleted, not retained.'); }}>Reject</Button>
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
                {REPORTS.map((r) => {
                  const st = rState[r.id]; const res = R_RES[st];
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
                          <Button variant="primary" onClick={() => setDialog({ id: r.id, count: 31 })}>Suspend and notify</Button>
                          <Button variant="outline" onClick={() => { setR((p) => ({ ...p, [r.id]: 'warned' })); say('Warning sent. A second warning within six months triggers automatic suspension.'); }}>Warn the manager</Button>
                          <Button variant="ghost" onClick={() => { setR((p) => ({ ...p, [r.id]: 'dismissed' })); say('Closed with no action. The reporter is told a decision was made, not what it was.'); }}>No action needed</Button>
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
                  {PAYMENTS.map((p) => {
                    const st = pState[p.id]; const r = P_RES[st];
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
                              <Button variant="primary" size="sm" onClick={() => { setP((x) => ({ ...x, [p.id]: 'confirmed' })); say(`${p.name}’s ${p.tier} plan is active for the month. Receipt sent by SMS.`); }}>Confirm</Button>
                              <Button variant="ghost" size="sm" onClick={() => { setP((x) => ({ ...x, [p.id]: 'flagged' })); say(`Marked not found. ${p.name.split(' ')[0]} is asked to re-check the transaction ID — no account change yet.`); }}>Not found</Button>
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
