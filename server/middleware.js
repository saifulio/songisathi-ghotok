// Request guards.
//
// These are attached per route rather than with router.use(): every router is
// mounted on the same /api prefix, so a router-wide guard would also run for
// requests merely passing through on their way to a later router.

import jwt from 'jsonwebtoken';
import { queryOne } from '../db/pool.js';
import { JWT_SECRET } from './config.js';
import { bad } from './lib/http.js';

// Verifies the Bearer token and hangs { sub, role } on req.auth.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return bad(res, 'Not authenticated.', 401);
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return bad(res, 'Invalid or expired token.', 401);
  }
}

// Gates a route to specific roles (use after requireAuth).
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role) ? next() : bad(res, 'Not allowed for your role.', 403);

// Loads the ghotok row for the signed-in user onto req.ghotok, or refuses.
async function loadGhotok(req, res, next) {
  const ghotok = await queryOne('SELECT * FROM ghotoks WHERE userId = ? LIMIT 1', [req.auth.sub]);
  if (!ghotok) return bad(res, 'No matchmaker profile is linked to this account.', 403);
  req.ghotok = ghotok;
  next();
}

// The three audiences the API serves. Spread into a route's middleware list:
//   router.get('/profiles', ghotokOnly, handler)
export const ghotokOnly = [requireAuth, requireRole('GHOTOK'), loadGhotok];
export const adminOnly = [requireAuth, requireRole('ADMIN')];
// A guardian, or the bride/groom themselves — see myProfileForReq.
export const memberOnly = [requireAuth, requireRole('GUARDIAN', 'CANDIDATE')];
