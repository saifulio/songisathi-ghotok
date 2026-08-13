// Environment-derived settings, in one place so nothing else reads process.env.

import 'dotenv/config';

export const PORT = process.env.API_PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Token lifetimes.
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; //  1 hour

// Active profiles each plan allows — set when a matchmaker signs up, and
// re-applied whenever an admin confirms an upgrade payment.
export const TIER_LIMIT = { SOLO: 20, BUREAU: 50, AGENCY: 150 };

// ── the family side of the price list ──
// A guardian / bride / groom account is free, and stays useful while free:
// browsing, biodata, and proposals sent to them are never metered. What
// Premium buys is reach — how many interests the household may send in a
// calendar month, and how far down the scored list it may read.
export const MEMBER_FREE_INTEREST_LIMIT = 3;
export const MEMBER_FREE_MATCH_LIMIT = 3;
export const MEMBER_PREMIUM_MATCH_LIMIT = 8;

// How long a confirmed payment runs for, by billing cycle.
export const BILLING_DAYS = { MONTHLY: 30, ANNUAL: 365 };
