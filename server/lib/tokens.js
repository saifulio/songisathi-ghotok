// Session tokens (JWT) and the one-time tokens emailed for verification and
// password reset.

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

// A one-time token: a raw random string (returned, goes in the email link) and
// its SHA-256 hash (stored, so a DB leak never exposes a usable token).
export const makeToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

export const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');
