// What plan a family account is on, and what that plan lets it do.
//
// A member account has no subscription row until it buys one, so the free
// plan is the absence of a row rather than a row we write at signup. An
// expired row is read the same way — `expiresAt` is what decides, so a lapsed
// subscription falls back to free on the next request without a nightly job
// to demote it.
//
// The matchmaker side of billing is not here: a ghotok's plan lives on
// ghotoks.tier and is applied as an active-profile limit (see config.js
// TIER_LIMIT and the admin payments queue).

import { query, queryOne } from '../../db/pool.js';
import {
  MEMBER_FREE_INTEREST_LIMIT, MEMBER_FREE_MATCH_LIMIT, MEMBER_PREMIUM_MATCH_LIMIT,
  BILLING_DAYS,
} from '../config.js';

// The subscription row that is actually in force, or null. Cancelled and
// expired both read as null: either way the account is on free today.
export async function activeSubscription(userId) {
  const row = await queryOne('SELECT * FROM member_subscriptions WHERE userId = ? LIMIT 1', [userId]);
  if (!row || row.status !== 'ACTIVE') return null;
  return new Date(row.expiresAt).getTime() > Date.now() ? row : null;
}

// First day of the current calendar month, in UTC — the window the free
// interest allowance is counted over, so it resets on the 1st rather than
// running from whenever the account happened to sign up.
const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

// Interests this account has sent this month, counted across every profile it
// holds: the allowance belongs to the household, not to one daughter. Photo
// and contact-release requests are part of the same conversation, so they are
// counted too — a manager should not be able to spend the cap sideways.
export async function interestsSentThisMonth(profileIds) {
  if (!profileIds.length) return 0;
  const rows = await query(
    `SELECT COUNT(*) AS n FROM interests
      WHERE theirProfileId IN (${profileIds.map(() => '?').join(',')})
        AND createdAt >= ?`,
    [...profileIds, monthStart()]
  );
  return Number(rows[0]?.n || 0);
}

// The whole answer for one member account: which plan, what it allows, and
// how much of the metered part is already spent. Every member route that has
// to gate something reads this, and /my-plan reports it verbatim.
export async function memberPlan(userId, profileIds = []) {
  const sub = await activeSubscription(userId);
  const premium = Boolean(sub);
  const interestsUsed = premium ? 0 : await interestsSentThisMonth(profileIds);
  const interestLimit = premium ? null : MEMBER_FREE_INTEREST_LIMIT;

  return {
    tier: premium ? 'PREMIUM' : 'FREE',
    premium,
    status: premium ? sub.status : 'FREE',
    billing: premium ? sub.billing : null,
    startedAt: premium ? sub.startedAt : null,
    expiresAt: premium ? sub.expiresAt : null,
    // null means unlimited — the UI prints "unlimited" rather than a number.
    interestLimit,
    interestsUsed,
    interestsLeft: premium ? null : Math.max(0, MEMBER_FREE_INTEREST_LIMIT - interestsUsed),
    matchLimit: premium ? MEMBER_PREMIUM_MATCH_LIMIT : MEMBER_FREE_MATCH_LIMIT,
  };
}

// When a payment confirmed today should run to. An upgrade bought while a
// subscription is still running extends it rather than throwing away the
// remainder — the family paid for those days.
export function expiryFor(billing, current = null) {
  const days = BILLING_DAYS[billing] ?? BILLING_DAYS.MONTHLY;
  const from = current && new Date(current).getTime() > Date.now() ? new Date(current) : new Date();
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

// The published price of a plan, read from pricing_tiers rather than a
// constant — the price list is data, and the admin queue matches against what
// was actually charged.
export const memberPremiumTier = () =>
  queryOne("SELECT * FROM pricing_tiers WHERE audience = 'MEMBER' AND code = 'PREMIUM' LIMIT 1");
