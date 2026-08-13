// The family side of billing: the published price list, the plan an account
// is on, and submitting the payment that buys Premium.
//
// Payment is the same manual flow the matchmaker upgrades use — the family
// sends money over bKash / Nagad / Rocket and files the transaction id here,
// which lands as a PENDING row in the admin queue. Nothing is granted until an
// admin matches it against the merchant statement (see routes/admin.js); this
// route never activates a subscription itself.

import express from 'express';
import { query, queryOne, withTransaction, insert } from '../../db/pool.js';
import { bad } from '../lib/http.js';
import { memberPlan, memberPremiumTier } from '../lib/subscriptions.js';
import { MEMBER_FREE_INTEREST_LIMIT, MEMBER_FREE_MATCH_LIMIT, MEMBER_PREMIUM_MATCH_LIMIT } from '../config.js';
import { requireAuth, memberOnly } from '../middleware.js';

const router = express.Router();

const METHODS = ['BKASH', 'NAGAD', 'ROCKET'];
const BILLINGS = ['MONTHLY', 'ANNUAL'];

const tierCard = (t) => ({
  code: t.code,
  audience: t.audience,
  nameEn: t.nameEn,
  nameBn: t.nameBn,
  monthlyPrice: t.monthlyPrice,
  annualPrice: t.annualPrice,
  profileLimit: t.profileLimit,
});

// What each plan gets a family, in the order the Membership page lists them.
// Kept beside the prices rather than in the client so the caps quoted to a
// user and the caps the API enforces cannot drift apart.
const memberFeatures = () => ({
  free: [
    'Browse every published biodata in the network',
    'Receive and decide on any number of proposals',
    `Send ${MEMBER_FREE_INTEREST_LIMIT} interests a month`,
    `See your top ${MEMBER_FREE_MATCH_LIMIT} scored matches`,
    'Your private answers stay sealed — on every plan',
  ],
  premium: [
    'Send as many interests as you have families to approach',
    `See all ${MEMBER_PREMIUM_MATCH_LIMIT} scored matches, with the reasoning behind each`,
    'Everything on the free plan, unchanged',
  ],
});

// ── the published price list ──
// Readable by any signed-in account: a guardian is shown the member plan, and
// the ghotok tiers are what the onboarding page already prints publicly.
router.get('/plans', requireAuth, async (req, res) => {
  const audience = String(req.query.audience || '').toUpperCase();
  const rows = audience === 'GHOTOK' || audience === 'MEMBER'
    ? await query('SELECT * FROM pricing_tiers WHERE audience = ? ORDER BY monthlyPrice', [audience])
    : await query('SELECT * FROM pricing_tiers ORDER BY audience, monthlyPrice');
  return res.json({ plans: rows.map(tierCard), features: memberFeatures() });
});

// ── the plan this family is on ──
// Reports the caps and how much of the metered one is spent, so the member
// pages render from the same numbers the API enforces. Readable by every
// member account, including a candidate whose profile someone else manages —
// the plan is on the account, and knowing what it allows is not acting.
router.get('/my-plan', memberOnly, async (req, res) => {
  const plan = await memberPlan(req.auth.sub, req.myProfiles.map((p) => p.id));
  const tier = await memberPremiumTier();
  const payments = await query(
    'SELECT id, transactionId, method, amount, billing, status, paidAt FROM payments WHERE userId = ? ORDER BY paidAt DESC LIMIT 10',
    [req.auth.sub]
  );

  return res.json({
    plan,
    premiumPlan: tier ? tierCard(tier) : null,
    features: memberFeatures(),
    payments: payments.map((p) => ({
      id: p.id,
      txn: p.transactionId,
      method: p.method,
      amount: p.amount,
      billing: p.billing,
      status: p.status,
      paidAt: p.paidAt,
    })),
  });
});

// ── file a Premium payment ──
// body: { transactionId, method: 'BKASH'|'NAGAD'|'ROCKET', billing: 'MONTHLY'|'ANNUAL' }
// The amount is taken from the price list, never from the request — what the
// family types is only the transaction id an admin will match.
router.post('/my-plan/payments', memberOnly, async (req, res) => {
  const b = req.body || {};
  const transactionId = String(b.transactionId || '').trim().toUpperCase();
  if (!transactionId) return bad(res, 'The transaction id from your payment receipt is required.');
  const method = String(b.method || '').toUpperCase();
  if (!METHODS.includes(method)) return bad(res, 'method must be BKASH, NAGAD, or ROCKET.');
  const billing = String(b.billing || 'MONTHLY').toUpperCase();
  if (!BILLINGS.includes(billing)) return bad(res, 'billing must be MONTHLY or ANNUAL.');

  const tier = await memberPremiumTier();
  if (!tier) return bad(res, 'Premium is not on sale right now.', 409);

  // An annual price is quoted per month, the same way the onboarding page
  // prints the ghotok tiers — so a year is twelve of them.
  const amount = billing === 'ANNUAL' ? tier.annualPrice * 12 : tier.monthlyPrice;

  const existing = await queryOne('SELECT id, userId FROM payments WHERE transactionId = ? LIMIT 1', [transactionId]);
  if (existing) {
    return bad(
      res,
      existing.userId === req.auth.sub
        ? 'That transaction id is already filed and waiting to be matched.'
        : 'That transaction id is already on record. Check the receipt and try again.',
      409
    );
  }
  const pending = await queryOne(
    "SELECT id FROM payments WHERE userId = ? AND status = 'PENDING' LIMIT 1",
    [req.auth.sub]
  );
  if (pending) return bad(res, 'You already have a payment waiting to be matched. It is usually done within a day.', 409);

  const id = await withTransaction((tx) => insert(
    tx,
    `INSERT INTO payments (ghotokId, userId, transactionId, method, amount, tier, billing, status)
     VALUES (NULL, ?, ?, ?, ?, 'PREMIUM', ?, 'PENDING')`,
    [req.auth.sub, transactionId, method, amount, billing]
  ));

  return res.status(201).json({
    payment: { id, txn: transactionId, method, amount, billing, status: 'PENDING' },
    note: 'Filed. An admin matches it against the merchant statement — usually within a day — and Premium starts the moment it is confirmed.',
  });
});

export default router;
