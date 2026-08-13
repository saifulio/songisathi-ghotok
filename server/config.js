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
