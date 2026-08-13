// Request guards.
//
// These are attached per route rather than with router.use(): every router is
// mounted on the same /api prefix, so a router-wide guard would also run for
// requests merely passing through on their way to a later router.

import jwt from 'jsonwebtoken';
import { queryOne } from '../db/pool.js';
import { JWT_SECRET } from './config.js';
import { bad } from './lib/http.js';
import { myProfilesForReq, profileContext } from './lib/accounts.js';

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

// Loads what a member account may act on:
//   req.myProfiles — every profile they hold (a guardian holds up to five),
//   req.guardian   — their guardian row, for a guardian,
//   req.me         — { profile, selfManaged } for the one profile this request
//                    is about, or null when the account holds none yet.
// Which profile that is: the one named by ?profileId= (or body.profileId),
// falling back to the first — so a single-profile account, and every client
// that predates the switcher, keeps working without naming anything.
async function loadMyProfiles(req, res, next) {
  const { guardian, profiles } = await myProfilesForReq(req);
  req.guardian = guardian;
  req.myProfiles = profiles;

  const named = Number(req.query?.profileId ?? req.body?.profileId) || null;
  const profile = named ? profiles.find((p) => p.id === named) : profiles[0];
  if (named && !profile) return bad(res, 'That profile is not one of yours.', 403);

  req.me = profile ? profileContext(req, profile) : null;
  next();
}

// The three audiences the API serves. Spread into a route's middleware list:
//   router.get('/profiles', ghotokOnly, handler)
export const ghotokOnly = [requireAuth, requireRole('GHOTOK'), loadGhotok];
export const adminOnly = [requireAuth, requireRole('ADMIN')];
// A guardian, or the bride/groom themselves — see loadMyProfiles.
export const memberOnly = [requireAuth, requireRole('GUARDIAN', 'CANDIDATE'), loadMyProfiles];

// Anyone who manages a profile, with whatever their side needs loaded: a
// ghotok gets req.ghotok, a member gets req.myProfiles and req.me. For the
// routes both chairs use — sending an interest is the same act from either.
export const managerOnly = [
  requireAuth,
  requireRole('GHOTOK', 'GUARDIAN', 'CANDIDATE'),
  (req, res, next) => (req.auth.role === 'GHOTOK' ? loadGhotok(req, res, next) : loadMyProfiles(req, res, next)),
];
