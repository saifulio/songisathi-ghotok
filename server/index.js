// SongiSathi Ghotok — API entry point.
// Run: npm run server   (needs the MySQL DB migrated: npm run db:migrate)
//
// This file only wires things up. The endpoints live in routes/, the helpers
// they share in lib/, the request guards in middleware.js, and settings read
// from the environment in config.js.
//
// Data access is plain MySQL via mysql2 (see db/pool.js) — no ORM.

import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';
import { bad } from './lib/http.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import dashboardRoutes from './routes/dashboard.js';
import interestRoutes from './routes/interests.js';
import marriageRoutes from './routes/marriages.js';
import adminRoutes from './routes/admin.js';
import meRoutes from './routes/me.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Every router is mounted on /api and declares its own full sub-paths, so a
// request falls through to the next router until one matches. Guards are
// attached per route rather than router-wide, for the same reason
// (see middleware.js).
app.use('/api', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', interestRoutes);
app.use('/api', marriageRoutes);
app.use('/api', adminRoutes);
app.use('/api', meRoutes);

// ── fallbacks ──
// Any route not matched above.
app.use((_req, res) => bad(res, 'Not found.', 404));

// Catches anything thrown/rejected in a route (e.g. the DB being unreachable)
// so the client always gets JSON, never Express's default HTML error page.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  bad(res, 'Something went wrong on our end. Please try again in a moment.', 500);
});

app.listen(PORT, () => {
  console.log(`SongiSathi API running at http://localhost:${PORT}`);
});
