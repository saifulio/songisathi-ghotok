// The family's own plan: what they are on today, what Premium adds, and the
// form that files a payment for it.
//
// Payment is manual, the same way a matchmaker's upgrade is: the family sends
// money over bKash / Nagad / Rocket from their own phone and files the
// transaction id here. Nothing is granted at this point — the row waits in the
// admin queue until it is matched against the merchant statement. The page
// says so plainly rather than showing a spinner that implies otherwise.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Select, Badge, Avatar } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import PageFrame from '../../components/PageFrame.jsx';
import './Membership.css';

const METHODS = [
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
];

const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`;
const onDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const PAY_STATUS = {
  PENDING: { label: 'Waiting to be matched', tone: 'pending' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  FLAGGED: { label: 'Flagged — contact support', tone: 'error' },
};

export default function Membership() {
  const { user, token } = useAuth();
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
    <PageFrame note="Membership" right={<Avatar initials={initialsOf(user?.fullName)} size={28} />}>

        <div className="mp-body">
          <div className="mp-head">
            <div>
              <div className="mp-h-bn">আপনার সদস্যপদ</div>
              <div className="mp-h-sub">
                Browsing, your biodata, and every proposal sent to you are free, and stay free. Premium is
                about reach — how many families you can approach yourself, and how far down your scored
                matches you can read.
              </div>
            </div>
            {plan && (
              <Badge tone={premium ? 'success' : 'neutral'}>{premium ? 'Premium' : 'Free plan'}</Badge>
            )}
          </div>

          {loading && <div className="mp-card">Loading your plan…</div>}

          {!loading && plan && (
            <div className="mp-card">
              <div className="mp-card-t">Where you stand</div>
              <div className="mp-stats">
                <div className="mp-stat">
                  <div className="mp-stat-num">{plan.interestLimit === null ? 'Unlimited' : `${plan.interestsLeft} left`}</div>
                  <div className="mp-stat-cap">
                    {plan.interestLimit === null
                      ? 'Interests you can send this month'
                      : `Of ${plan.interestLimit} interests this month · resets on the 1st`}
                  </div>
                </div>
                <div className="mp-stat">
                  <div className="mp-stat-num">{plan.matchLimit}</div>
                  <div className="mp-stat-cap">Scored matches you can read</div>
                </div>
                <div className="mp-stat">
                  <div className="mp-stat-num">{premium ? onDate(plan.expiresAt) : '—'}</div>
                  <div className="mp-stat-cap">{premium ? `Premium runs until · billed ${plan.billing === 'ANNUAL' ? 'yearly' : 'monthly'}` : 'No subscription on this account'}</div>
                </div>
              </div>
            </div>
          )}

          {!loading && features && (
            <div className="mp-plans">
              <div className={`mp-plan ${premium ? '' : 'current'}`}>
                <div className="mp-plan-head">
                  <div className="mp-plan-name">Free</div>
                  <div className="mp-plan-bn">বিনামূল্যে</div>
                </div>
                <div className="mp-plan-price-row"><span className="mp-plan-price">৳0</span><span className="mp-plan-per">/month</span></div>
                <div className="mp-plan-features">
                  {features.free.map((f) => (<div key={f} className="mp-plan-feature"><span className="mp-tick">✓</span><span>{f}</span></div>))}
                </div>
                {!premium && <div className="mp-plan-flag">Your plan</div>}
              </div>

              {tier && (
                <div className={`mp-plan featured ${premium ? 'current' : ''}`}>
                  <div className="mp-plan-head">
                    <div className="mp-plan-name">{tier.nameEn}</div>
                    <div className="mp-plan-bn">{tier.nameBn}</div>
                  </div>
                  <div className="mp-plan-price-row">
                    <span className="mp-plan-price">{taka(billing === 'ANNUAL' ? tier.annualPrice : tier.monthlyPrice)}</span>
                    <span className="mp-plan-per">/month</span>
                  </div>
                  <div className="mp-plan-price-note">
                    {billing === 'ANNUAL' ? `billed yearly · ${taka(tier.annualPrice * 12)} · 20% saved` : 'billed monthly · stop any time'}
                  </div>
                  <div className="mp-plan-features">
                    {features.premium.map((f) => (<div key={f} className="mp-plan-feature"><span className="mp-tick">✓</span><span>{f}</span></div>))}
                  </div>
                  {premium && <div className="mp-plan-flag">Your plan</div>}
                </div>
              )}
            </div>
          )}

          {!loading && tier && (
            <div className="mp-card">
              <div className="mp-card-t">{premium ? 'Extend Premium' : 'Take Premium'}</div>
              <div className="mp-pay-note">
                Send {taka(chargeable)} to the SongiSathi merchant number from your own {METHODS.find((m) => m.value === method)?.label} account,
                then file the transaction id below. An admin matches it against the merchant statement — usually within a day.
                {premium && ' Days already paid for are not lost: an extension starts from your current expiry.'}
              </div>

              {pending ? (
                <div className="mp-pending">
                  Transaction <strong>{pending.txn}</strong> for {taka(pending.amount)} is filed and waiting to be matched.
                  Nothing more is needed from you — Premium starts the moment it is confirmed.
                </div>
              ) : (
                <>
                  <div className="mp-grid">
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
                  <div className="mp-actions">
                    <span className="mp-actions-note">Filing a transaction id does not charge you — the payment has already left your wallet.</span>
                    <Button variant="primary" onClick={submit} disabled={busy || !txn.trim()}>
                      {busy ? 'Filing…' : 'File this payment'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {!loading && (data?.payments || []).length > 0 && (
            <div className="mp-card">
              <div className="mp-card-t">Your payments</div>
              <div className="mp-pay-list">
                {data.payments.map((p) => {
                  const st = PAY_STATUS[p.status] || { label: p.status, tone: 'neutral' };
                  return (
                    <div key={p.id} className="mp-pay-row">
                      <span className="mp-pay-txn">{p.txn}</span>
                      <span className="mp-pay-meta">{taka(p.amount)} · {p.billing === 'ANNUAL' ? 'yearly' : 'monthly'} · {onDate(p.paidAt)}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      {toast && (<div className="mp-toast"><span className="mp-toast-check">✓</span><span>{toast}</span></div>)}
    </PageFrame>
  );
}
