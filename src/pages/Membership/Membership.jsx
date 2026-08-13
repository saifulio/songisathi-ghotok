// The family's own plan: what they are on today, what Premium adds, and the
// form that files a payment for it.
//
// Payment is manual, the same way a matchmaker's upgrade is: the family sends
// money over bKash / Nagad / Rocket from their own phone and files the
// transaction id here. Nothing is granted at this point — the row waits in the
// admin queue until it is matched against the merchant statement. The page
// says so plainly rather than showing a spinner that implies otherwise.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Select, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './Membership.css';

const METHODS = [
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
];

const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`;
const onDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const PAY_STATUS = {
  PENDING: { label: 'Waiting to be matched', tone: 'pending' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  FLAGGED: { label: 'Flagged — contact support', tone: 'error' },
};

export default function Membership() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState('ANNUAL');
  const [method, setMethod] = useState('BKASH');
  const [txn, setTxn] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 5200); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const load = useCallback(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.myPlan(token)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) say(e.message || 'Could not load your plan.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, say]);
  useEffect(load, [load]);

  const plan = data?.plan;
  const tier = data?.premiumPlan;
  const features = data?.features;
  const premium = Boolean(plan?.premium);
  // An annual price is quoted per month, as the ghotok tiers are — so what is
  // actually charged for a year is twelve of them. Mirrors the server, which
  // is what decides the amount on the row.
  const chargeable = tier ? (billing === 'ANNUAL' ? tier.annualPrice * 12 : tier.monthlyPrice) : 0;
  const pending = (data?.payments || []).find((p) => p.status === 'PENDING');

  const submit = async () => {
    if (busy || !txn.trim()) return;
    setBusy(true);
    try {
      const { note } = await api.submitMyPlanPayment(token, { transactionId: txn.trim(), method, billing });
      setTxn('');
      say(note || 'Filed. Premium starts the moment it is confirmed.');
      load();
    } catch (e) {
      say(e.message || 'Could not file that payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb">
      <div className="mb-frame">
        <div className="mb-head">
          <div>
            <div className="mb-h-bn">আপনার সদস্যপদ</div>
            <div className="mb-h-sub">
              Browsing, your biodata, and every proposal sent to you are free, and stay free. Premium is
              about reach — how many families you can approach yourself, and how far down your scored
              matches you can read.
            </div>
          </div>
          {plan && (
            <Badge tone={premium ? 'success' : 'neutral'}>{premium ? 'Premium' : 'Free plan'}</Badge>
          )}
        </div>

        {loading && <div className="mb-card">Loading your plan…</div>}

        {!loading && plan && (
          <div className="mb-card">
            <div className="mb-card-t">Where you stand</div>
            <div className="mb-stats">
              <div className="mb-stat">
                <div className="mb-stat-num">{plan.interestLimit === null ? 'Unlimited' : `${plan.interestsLeft} left`}</div>
                <div className="mb-stat-cap">
                  {plan.interestLimit === null
                    ? 'Interests you can send this month'
                    : `Of ${plan.interestLimit} interests this month · resets on the 1st`}
                </div>
              </div>
              <div className="mb-stat">
                <div className="mb-stat-num">{plan.matchLimit}</div>
                <div className="mb-stat-cap">Scored matches you can read</div>
              </div>
              <div className="mb-stat">
                <div className="mb-stat-num">{premium ? onDate(plan.expiresAt) : '—'}</div>
                <div className="mb-stat-cap">{premium ? `Premium runs until · billed ${plan.billing === 'ANNUAL' ? 'yearly' : 'monthly'}` : 'No subscription on this account'}</div>
              </div>
            </div>
          </div>
        )}

        {!loading && features && (
          <div className="mb-plans">
            <div className={`mb-plan ${premium ? '' : 'current'}`}>
              <div className="mb-plan-head">
                <div className="mb-plan-name">Free</div>
                <div className="mb-plan-bn">বিনামূল্যে</div>
              </div>
              <div className="mb-plan-price-row"><span className="mb-plan-price">৳0</span><span className="mb-plan-per">/month</span></div>
              <div className="mb-plan-features">
                {features.free.map((f) => (<div key={f} className="mb-plan-feature"><span className="mb-tick">✓</span><span>{f}</span></div>))}
              </div>
              {!premium && <div className="mb-plan-flag">Your plan</div>}
            </div>

            {tier && (
              <div className={`mb-plan featured ${premium ? 'current' : ''}`}>
                <div className="mb-plan-head">
                  <div className="mb-plan-name">{tier.nameEn}</div>
                  <div className="mb-plan-bn">{tier.nameBn}</div>
                </div>
                <div className="mb-plan-price-row">
                  <span className="mb-plan-price">{taka(billing === 'ANNUAL' ? tier.annualPrice : tier.monthlyPrice)}</span>
                  <span className="mb-plan-per">/month</span>
                </div>
                <div className="mb-plan-price-note">
                  {billing === 'ANNUAL' ? `billed yearly · ${taka(tier.annualPrice * 12)} · 20% saved` : 'billed monthly · stop any time'}
                </div>
                <div className="mb-plan-features">
                  {features.premium.map((f) => (<div key={f} className="mb-plan-feature"><span className="mb-tick">✓</span><span>{f}</span></div>))}
                </div>
                {premium && <div className="mb-plan-flag">Your plan</div>}
              </div>
            )}
          </div>
        )}

        {!loading && tier && (
          <div className="mb-card">
            <div className="mb-card-t">{premium ? 'Extend Premium' : 'Take Premium'}</div>
            <div className="mb-pay-note">
              Send {taka(chargeable)} to the SongiSathi merchant number from your own {METHODS.find((m) => m.value === method)?.label} account,
              then file the transaction id below. An admin matches it against the merchant statement — usually within a day.
              {premium && ' Days already paid for are not lost: an extension starts from your current expiry.'}
            </div>

            {pending ? (
              <div className="mb-pending">
                Transaction <strong>{pending.txn}</strong> for {taka(pending.amount)} is filed and waiting to be matched.
                Nothing more is needed from you — Premium starts the moment it is confirmed.
              </div>
            ) : (
              <>
                <div className="mb-grid">
                  <Select
                    label="Billing"
                    value={billing}
                    onChange={(e) => setBilling(e.target.value)}
                    options={[
                      { value: 'ANNUAL', label: `Yearly — ${taka(tier.annualPrice * 12)}` },
                      { value: 'MONTHLY', label: `Monthly — ${taka(tier.monthlyPrice)}` },
                    ]}
                  />
                  <Select label="Paid with" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} />
                  <Input label="Transaction id" placeholder="e.g. BKS8H2K91M" value={txn} onChange={(e) => setTxn(e.target.value)} />
                </div>
                <div className="mb-actions">
                  <span className="mb-actions-note">Filing a transaction id does not charge you — the payment has already left your wallet.</span>
                  <Button variant="primary" onClick={submit} disabled={busy || !txn.trim()}>
                    {busy ? 'Filing…' : 'File this payment'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && (data?.payments || []).length > 0 && (
          <div className="mb-card">
            <div className="mb-card-t">Your payments</div>
            <div className="mb-pay-list">
              {data.payments.map((p) => {
                const st = PAY_STATUS[p.status] || { label: p.status, tone: 'neutral' };
                return (
                  <div key={p.id} className="mb-pay-row">
                    <span className="mb-pay-txn">{p.txn}</span>
                    <span className="mb-pay-meta">{taka(p.amount)} · {p.billing === 'ANNUAL' ? 'yearly' : 'monthly'} · {onDate(p.paidAt)}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {toast && (<div className="mb-toast"><span className="mb-toast-check">✓</span><span>{toast}</span></div>)}
    </div>
  );
}
