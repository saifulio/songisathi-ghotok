import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge, Tabs, Input, Checkbox } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import PageFrame from '../../components/PageFrame.jsx';
import './Commission.css';

const taka = (n) => '৳' + Number(n || 0).toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => { const dt = new Date(d); return isNaN(dt) ? '—' : `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`; };
const fmtSince = (d) => { const dt = new Date(d); return isNaN(dt) ? '' : `${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };

export default function Commission() {
  const { user, token } = useAuth();
  const [rows, setRows] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [reminded, setReminded] = useState({});
  const [closeOpen, setCloseOpen] = useState(false);
  const [flowStep, setFlowStep] = useState(1);
  const [pickedPair, setPickedPair] = useState(null);
  const [feeBride, setFeeBride] = useState('25000');
  const [feeGroom, setFeeGroom] = useState('15000');
  const [weddingDate, setWeddingDate] = useState('2026-08-07');
  const [paidFull, setPaidFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justClosedLabel, setJustClosedLabel] = useState('');
  const [closedCount, setClosedCount] = useState(0);
  const [yearsActive, setYearsActive] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 4400); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Load the ledger, the pairs this ghotok could close, the family
  // testimonials rail, and the lifetime stats.
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    Promise.all([api.marriages(token), api.closablePairs(token), api.testimonials(token), api.dashboardStats(token)])
      .then(([m, p, t, s]) => {
        if (!live) return;
        setRows(m.marriages);
        setPairs(p.pairs);
        setTestimonials(t.testimonials);
        setPickedPair((cur) => cur ?? p.pairs[0]?.id ?? null);
        setClosedCount(s.stats.marriagesClosed);
        setYearsActive(s.stats.yearsActive);
      })
      .catch((e) => say(e.message || 'Could not load the commission ledger.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, say]);

  const filtered = rows.filter((l) => filter === 'paid' ? l.received >= l.agreed : filter === 'owing' ? l.received < l.agreed : true);
  const outstanding = rows.reduce((n, l) => n + Math.max(0, l.agreed - l.received), 0);
  const now = new Date();
  const monthTotal = rows
    .filter((l) => { const d = new Date(l.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((n, l) => n + l.received, 0);
  const avg = rows.length ? Math.round(rows.reduce((n, l) => n + l.agreed, 0) / rows.length) : 0;
  const owingCount = rows.filter((l) => l.received < l.agreed).length;
  const picked = pairs.find((p) => p.id === pickedPair);
  const feeTotal = Number(feeBride || 0) + Number(feeGroom || 0);

  const summary = [
    { label: 'This month', value: taka(monthTotal), note: 'received', fg: 'var(--text-primary)' },
    { label: 'Outstanding', value: taka(outstanding), note: owingCount === 0 ? 'all settled' : `across ${owingCount}${owingCount === 1 ? ' family' : ' families'}`, fg: owingCount ? 'var(--gold-700)' : 'var(--brand-primary)' },
    { label: 'Marriages closed', value: String(closedCount), note: 'lifetime', fg: 'var(--brand-primary)' },
    { label: 'Average commission', value: taka(avg), note: 'per marriage', fg: 'var(--text-primary)' },
  ];
  const filters = [
    { value: 'all', label: 'All', count: rows.length },
    { value: 'owing', label: 'Owing', count: owingCount },
    { value: 'paid', label: 'Paid', count: rows.filter((l) => l.received >= l.agreed).length },
  ];
  const titles = { 1: { bn: 'কোন জোড়া?', en: 'Which pair are you closing?' }, 2: { bn: 'কমিশন ও তারিখ', en: 'Commission and wedding date' }, 3: { bn: 'অভিনন্দন', en: 'Recorded' } }[flowStep];

  const flowNext = async () => {
    if (flowStep === 1) {
      if (!picked) return say('No pair is ready to close yet.');
      setFlowStep(2);
      return;
    }
    if (flowStep === 2) {
      setBusy(true);
      try {
        const { marriage, marriagesClosed } = await api.recordMarriage(token, {
          profileAId: picked.profileAId, profileBId: picked.profileBId,
          brideFee: Number(feeBride) || 0, groomFee: Number(feeGroom) || 0,
          weddingDate, paidFull,
        });
        setRows((r) => [marriage, ...r]);
        setJustClosedLabel(picked.pair);
        setPairs((list) => list.filter((x) => x.id !== picked.id));
        setClosedCount(marriagesClosed);
        setFlowStep(3);
        say(`Recorded. Both profiles are closed and out of matching — ${taka(feeTotal)} logged, none of it ours.`);
      } catch (e) {
        say(e.message || 'Could not record this marriage.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setCloseOpen(false); setFlowStep(1);
  };
  const flowBack = () => { if (flowStep === 1) setCloseOpen(false); else setFlowStep(flowStep - 1); };

  return (
    <PageFrame
      note="কমিশন · Commission & closing"
      right={<><span>SongiSathi takes 0% of your commission</span><Avatar initials={initialsOf(user?.fullName)} size={28} /></>}
    >

        <div className="cm-summary">
          {summary.map((sm) => (
            <div key={sm.label} className="cm-summary-item">
              <div className="cm-summary-label">{sm.label}</div>
              <div className="cm-summary-val" style={{ color: sm.fg }}>{sm.value}</div>
              <div className="cm-summary-note">{sm.note}</div>
            </div>
          ))}
          <div className="cm-summary-cta">
            <Button variant="primary" onClick={() => { setCloseOpen(true); setFlowStep(1); }}>বিবাহ নথিভুক্ত করুন · Record a marriage</Button>
          </div>
        </div>

        <div className="cm-body">
          <div className="cm-ledger">
            <div className="cm-ledger-head">
              <div>
                <div className="cm-h-bn">কমিশন খাতা</div>
                <div className="cm-h-sub">Commission ledger · {rows.length} marriages recorded</div>
              </div>
              <Tabs items={filters} active={filter} onChange={setFilter} style={{ border: 'none' }} />
            </div>
            <div className="cm-table-wrap">
              <div className="cm-table">
                <div className="cm-thead"><span>Marriage</span><span>Date</span><span>Agreed</span><span>Received</span><span style={{ textAlign: 'right' }}>Status</span></div>
                {loading && <div className="cm-row" style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
                {!loading && filtered.length === 0 && <div className="cm-row" style={{ color: 'var(--text-secondary)' }}>No marriages in this view yet.</div>}
                {filtered.map((l) => {
                  const full = l.received >= l.agreed; const part = l.received > 0 && !full;
                  return (
                    <div key={l.id} className="cm-row">
                      <div className="cm-cell" data-label="Marriage"><div className="cm-pair">{l.pair}</div><div className="cm-prns">{l.prns}</div></div>
                      <span className="cm-date" data-label="Date">{fmtDate(l.date)}</span>
                      <span className="cm-agreed" data-label="Agreed">{taka(l.agreed)}</span>
                      <span data-label="Received" style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: full ? 'var(--brand-primary)' : part ? 'var(--gold-700)' : 'var(--terracotta-600)' }}>{taka(l.received)}</span>
                      <div className="cm-status">
                        <Badge tone={full ? 'success' : part ? 'warning' : 'pending'}>{full ? 'Paid' : part ? 'Part paid' : 'Unpaid'}</Badge>
                        {!full && <span className="cm-remind" onClick={() => { setReminded((s) => ({ ...s, [l.id]: true })); say(`A short, polite message was sent to both families about ${taka(l.agreed - l.received)} outstanding.`); }}>{reminded[l.id] ? 'Reminded' : 'Remind'}</span>}
                      </div>
                    </div>
                  );
                })}
                <div className="cm-total"><span>Outstanding across all families</span><span className="cm-total-val">{taka(outstanding)}</span></div>
              </div>
            </div>
          </div>

          <div className="cm-rail">
            <div className="cm-record">
              <div className="cm-record-label">Your record</div>
              <div className="cm-record-num"><span>{closedCount}</span><span className="cm-record-years">marriages{yearsActive != null ? `, ${yearsActive} years` : ''}</span></div>
              <div className="cm-record-note">Families see this number and your district next to your name. It is the only ranking on SongiSathi — there are no stars and no paid placement.</div>
              <div className="cm-record-stats">
                {[{ k: 'From the trusted pool', v: '6' }, { k: 'Longest search', v: '19 months' }, { k: 'Introductions per marriage', v: '4.2' }].map((rc) => (
                  <div key={rc.k} className="cm-record-stat"><span>{rc.k}</span><span className="cm-record-v">{rc.v}</span></div>
                ))}
              </div>
            </div>
            <div className="cm-testimonials">
              <div className="cm-testi-t">Words from families</div>
              <div className="cm-testi-sub">Asked once, a month after the wedding. Never chased.</div>
              <div className="cm-testi-list">
                {testimonials.length === 0 && <div className="cm-testi-sub">No testimonials yet.</div>}
                {testimonials.map((ts, i) => (
                  <div key={i} className="cm-testi"><div className="cm-testi-quote">{ts.quote}</div><div className="cm-testi-by">{ts.byLabel} · {ts.monthLabel}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>

      {closeOpen && (
        <div className="cm-overlay">
          <div className="cm-modal">
            <div className="cm-modal-head">
              <div>
                <div className="cm-h-bn" style={{ fontSize: 19 }}>{titles.bn}</div>
                <div className="cm-h-sub">{titles.en}</div>
              </div>
              <div className="cm-dots">{[1, 2, 3].map((n) => (<span key={n} className="cm-dot" style={{ background: n <= flowStep ? 'var(--brand-primary)' : 'var(--border-subtle)' }} />))}</div>
              <span className="cm-modal-close" onClick={() => { setCloseOpen(false); setFlowStep(1); }}>Close</span>
            </div>

            <div className="cm-modal-body">
              {flowStep === 1 && (
                <div className="cm-step">
                  <div className="cm-step-note">Both profiles close together and leave the matching pool. Their biodata stays in your book, marked married.</div>
                  {pairs.length === 0 && <div className="cm-step-note">No pair is ready to close yet — introduce or accept an interest first.</div>}
                  {pairs.map((p) => (
                    <div key={p.id} className="cm-pair-opt" onClick={() => setPickedPair(p.id)} style={{ borderColor: pickedPair === p.id ? 'var(--brand-primary)' : 'var(--border-subtle)', background: pickedPair === p.id ? 'var(--green-100)' : 'var(--surface-page)' }}>
                      <span className="cm-radio" style={{ borderColor: pickedPair === p.id ? 'var(--brand-primary)' : 'var(--border-default)' }}>{pickedPair === p.id && <span className="cm-radio-dot" />}</span>
                      <div className="cm-pair-opt-info"><div className="cm-pair-opt-name">{p.pair}</div><div className="cm-pair-opt-sub">{p.prns} · introduced {fmtSince(p.since)}</div></div>
                      <span className="cm-pair-opt-state">{p.state}</span>
                    </div>
                  ))}
                </div>
              )}
              {flowStep === 2 && (
                <div className="cm-step">
                  <div className="cm-step-note">Whatever the two families agreed with you. This is your record — nobody else sees it, and SongiSathi takes no share.</div>
                  <div className="cm-fee-grid">
                    <Input label="Bride’s family agreed" caption="কনের পরিবার" placeholder="৳" value={feeBride} onChange={(e) => setFeeBride(e.target.value.replace(/[^0-9]/g, ''))} />
                    <Input label="Groom’s family agreed" caption="বরের পরিবার" placeholder="৳" value={feeGroom} onChange={(e) => setFeeGroom(e.target.value.replace(/[^0-9]/g, ''))} />
                  </div>
                  <Input label="Wedding date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
                  <div className="cm-fee-total">
                    <div><div className="cm-fee-total-label">Total commission on this marriage</div><div className="cm-fee-total-val">{taka(feeTotal)}</div></div>
                    <div style={{ textAlign: 'right' }}><div className="cm-fee-share-label">SongiSathi’s share</div><div className="cm-fee-share-val">৳0</div></div>
                  </div>
                  <Checkbox label="Both families have paid in full" checked={paidFull} onChange={() => setPaidFull((v) => !v)} />
                </div>
              )}
              {flowStep === 3 && (
                <div className="cm-step">
                  <div className="cm-done">
                    <div className="cm-done-star">
                      <svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 2l2.6 6.8L22 10l-5.4 4.4L18 22l-6-3.8L6 22l1.4-7.6L2 10l7.4-1.2z" fill="var(--gold-400)" /></svg>
                    </div>
                    <div className="cm-done-bn">অভিনন্দন, {(user?.fullName || '').split(' ')[0] || 'আপা'}</div>
                    <div className="cm-done-body">{justClosedLabel} — recorded. That is {closedCount} marriages in your career.</div>
                  </div>
                  <div className="cm-word">
                    <div className="cm-word-t">Ask the families for a word?</div>
                    <div className="cm-word-b">A short message goes out one month after the wedding, once — never a reminder. Anything they write is shown with their permission only.</div>
                    <div className="cm-word-actions">
                      <Button variant="primary" onClick={() => { setCloseOpen(false); setFlowStep(1); say('A message will go to both families in one month. You will not be asked to chase it.'); }}>Yes, in a month</Button>
                      <Button variant="ghost" onClick={() => { setCloseOpen(false); setFlowStep(1); }}>No, leave them</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {flowStep !== 3 && (
              <div className="cm-modal-foot">
                <span className="cm-flow-back" onClick={flowBack}>{flowStep === 1 ? 'Cancel' : '← Back'}</span>
                <Button variant="primary" disabled={busy || (flowStep === 1 && !picked)} onClick={flowNext}>{flowStep === 1 ? 'Continue' : busy ? 'Recording…' : 'বিবাহ নথিভুক্ত করুন'}</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (<div className="cm-toast"><span className="cm-toast-check">✓</span><span>{toast}</span></div>)}
    </PageFrame>
  );
}
