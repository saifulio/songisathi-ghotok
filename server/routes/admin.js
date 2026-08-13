// Admin moderation: the ghotok verification queue, the reports queue, and the
// platform payments queue.
//
// No moderation decision deletes anything — suspending deactivates the account
// and pauses its profiles, both reversible.

import express from 'express';
import { query, queryOne, withTransaction } from '../../db/pool.js';
import { TIER_LIMIT } from '../config.js';
import { bad } from '../lib/http.js';
import { initialsOf, capWord, relativeTime } from '../lib/format.js';
import { expiryFor } from '../lib/subscriptions.js';
import { adminOnly } from '../middleware.js';

const router = express.Router();

const weekLabelShort = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

const paymentWhen = (d) => {
  const dt = new Date(d);
  const now = new Date();
  const hhmm = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(dt, now)) return `Today ${hhmm}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(dt, yesterday)) return `Yesterday ${hhmm}`;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${hhmm}`;
};

// Child rows for a set of parents, keyed by the foreign key — used to attach
// verification checks and report evidence without an N+1.
async function groupByParent(sql, key, ids) {
  const grouped = {};
  if (!ids.length) return grouped;
  const rows = await query(`${sql} WHERE ${key} IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
  for (const r of rows) (grouped[r[key]] ||= []).push(r);
  return grouped;
}

// A report's subjectRef is a ghotok code (GHT-…) or a profile PRN — resolve
// it so "Suspend" has something real to act on and the dialog can show a
// true profile count instead of a guess.
async function resolveReportSubject(subjectRef) {
  if (/^GHT-/i.test(subjectRef)) {
    const g = await queryOne('SELECT id, userId FROM ghotoks WHERE code = ? LIMIT 1', [subjectRef]);
    if (g) {
      const cnt = await queryOne('SELECT COUNT(*) AS n FROM profiles WHERE managedByGhotokId = ?', [g.id]);
      return { type: 'ghotok', ghotokId: g.id, userId: g.userId, profileCount: cnt.n };
    }
  }
  if (/^PRN-/i.test(subjectRef)) {
    const p = await queryOne('SELECT id FROM profiles WHERE prn = ? LIMIT 1', [subjectRef]);
    if (p) return { type: 'profile', profileId: p.id, profileCount: 1 };
  }
  return { type: 'unknown', profileCount: 0 };
}

// ── verification queue ──
router.get('/admin/verifications', adminOnly, async (_req, res) => {
  const V_STATUS = { PENDING: null, APPROVED: 'approved', MORE_INFO: 'more', REJECTED: 'rejected' };
  const rows = await query(
    `SELECT v.id, v.status, v.note, v.appliedAt, g.id AS ghotokId, g.code AS gid, g.district, gu.fullName AS name,
            (SELECT COUNT(*) FROM profiles WHERE managedByGhotokId = g.id) AS profileCount
       FROM verifications v
       JOIN ghotoks g ON v.ghotokId = g.id
       JOIN users gu ON g.userId = gu.id
      ORDER BY v.appliedAt ASC`
  );
  const checksByV = await groupByParent(
    'SELECT verificationId, label, passed, note FROM verification_checks',
    'verificationId',
    rows.map((r) => r.id)
  );

  return res.json({
    verifications: rows.map((v) => ({
      id: v.id,
      init: initialsOf(v.name),
      name: v.name,
      gid: v.gid,
      meta: `${v.district} · applied ${weekLabelShort(v.appliedAt)} · ${v.profileCount} profile${v.profileCount === 1 ? '' : 's'}`,
      note: v.note || '',
      status: V_STATUS[v.status] ?? null,
      checks: (checksByV[v.id] || []).map((c) => ({ label: c.label, ok: Boolean(c.passed), note: c.note })),
    })),
  });
});

// body: { decision: 'APPROVE' | 'MORE_INFO' | 'REJECT' }
router.patch('/admin/verifications/:id', adminOnly, async (req, res) => {
  const decision = req.body?.decision;
  const MAP = { APPROVE: 'APPROVED', MORE_INFO: 'MORE_INFO', REJECT: 'REJECTED' };
  if (!MAP[decision]) return bad(res, 'decision must be APPROVE, MORE_INFO, or REJECT.');
  const v = await queryOne('SELECT * FROM verifications WHERE id = ? LIMIT 1', [req.params.id]);
  if (!v) return bad(res, 'Verification not found.', 404);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE verifications SET status = ? WHERE id = ?', [MAP[decision], v.id]);
    if (decision === 'APPROVE') {
      await tx.execute('UPDATE ghotoks SET verified = 1 WHERE id = ?', [v.ghotokId]);
    }
    if (decision === 'REJECT') {
      // Deactivate the account without touching their data — a real,
      // reversible action; we don't delete anything on a moderation decision.
      const g = await queryOne('SELECT userId FROM ghotoks WHERE id = ?', [v.ghotokId]);
      if (g) await tx.execute('UPDATE users SET isActive = 0 WHERE id = ?', [g.userId]);
    }
  });
  return res.json({ ok: true, status: MAP[decision] });
});

// ── reports queue ──
router.get('/admin/reports', adminOnly, async (_req, res) => {
  const R_STATUS = { OPEN: null, SUSPENDED: 'suspended', WARNED: 'warned', DISMISSED: 'dismissed' };
  const TONE = { SERIOUS: 'error', MODERATE: 'warning', MINOR: 'neutral' };
  const rows = await query('SELECT * FROM reports ORDER BY createdAt DESC');
  const evByReport = await groupByParent(
    'SELECT reportId, text FROM report_evidence',
    'reportId',
    rows.map((r) => r.id)
  );

  const reports = await Promise.all(rows.map(async (r) => {
    const subject = await resolveReportSubject(r.subjectRef);
    return {
      id: r.id,
      title: r.title,
      subject: r.subjectRef,
      severity: capWord(r.severity),
      tone: TONE[r.severity] || 'neutral',
      by: r.reportedBy,
      when: relativeTime(r.createdAt),
      body: r.body,
      evidence: (evByReport[r.id] || []).map((e) => e.text),
      status: R_STATUS[r.status] ?? null,
      affectedProfileCount: subject.profileCount,
    };
  }));
  return res.json({ reports });
});

// body: { decision: 'SUSPEND' | 'WARN' | 'DISMISS' }
router.patch('/admin/reports/:id', adminOnly, async (req, res) => {
  const decision = req.body?.decision;
  const MAP = { SUSPEND: 'SUSPENDED', WARN: 'WARNED', DISMISS: 'DISMISSED' };
  if (!MAP[decision]) return bad(res, 'decision must be SUSPEND, WARN, or DISMISS.');
  const r = await queryOne('SELECT * FROM reports WHERE id = ? LIMIT 1', [req.params.id]);
  if (!r) return bad(res, 'Report not found.', 404);

  let affectedProfileCount = 0;
  await withTransaction(async (tx) => {
    await tx.execute('UPDATE reports SET status = ? WHERE id = ?', [MAP[decision], r.id]);
    if (decision === 'SUSPEND') {
      const subject = await resolveReportSubject(r.subjectRef);
      affectedProfileCount = subject.profileCount;
      if (subject.type === 'ghotok') {
        await tx.execute('UPDATE users SET isActive = 0 WHERE id = ?', [subject.userId]);
        await tx.execute("UPDATE profiles SET status = 'PAUSED' WHERE managedByGhotokId = ?", [subject.ghotokId]);
      } else if (subject.type === 'profile') {
        await tx.execute("UPDATE profiles SET status = 'PAUSED' WHERE id = ?", [subject.profileId]);
      }
    }
  });
  return res.json({ ok: true, status: MAP[decision], affectedProfileCount });
});

// ── platform payments queue ──
router.get('/admin/payments', adminOnly, async (_req, res) => {
  const P_STATUS = { PENDING: null, CONFIRMED: 'confirmed', FLAGGED: 'flagged' };
  const METHOD_LABEL = { BKASH: 'bKash', NAGAD: 'Nagad', ROCKET: 'Rocket' };
  // One queue, two payers: a matchmaker upgrading their tier, and a family
  // buying Premium. The joins are LEFT so a row of either kind survives them,
  // and the payer's name is whichever side the row names.
  const rows = await query(
    `SELECT p.*, g.code AS gid, gu.fullName AS ghotokName, mu.fullName AS memberName, mu.role AS memberRole
       FROM payments p
       LEFT JOIN ghotoks g  ON p.ghotokId = g.id
       LEFT JOIN users   gu ON g.userId = gu.id
       LEFT JOIN users   mu ON p.userId = mu.id
      ORDER BY p.paidAt DESC`
  );
  return res.json({
    payments: rows.map((p) => ({
      id: p.id,
      name: p.ghotokName || p.memberName,
      // The reference an admin matches by: a ghotok's code, or — for a family,
      // who has none — what kind of account it was.
      gid: p.gid || (p.memberRole === 'GUARDIAN' ? 'Guardian' : 'Candidate'),
      payer: p.ghotokId ? 'ghotok' : 'member',
      txn: p.transactionId,
      method: METHOD_LABEL[p.method] || p.method,
      amount: `৳${Number(p.amount).toLocaleString('en-US')}`,
      tier: capWord(p.tier),
      billing: capWord(p.billing),
      when: paymentWhen(p.paidAt),
      status: P_STATUS[p.status] ?? null,
    })),
  });
});

// body: { decision: 'CONFIRMED' | 'FLAGGED' }
router.patch('/admin/payments/:id', adminOnly, async (req, res) => {
  const decision = req.body?.decision;
  if (!['CONFIRMED', 'FLAGGED'].includes(decision)) return bad(res, 'decision must be CONFIRMED or FLAGGED.');
  const p = await queryOne('SELECT * FROM payments WHERE id = ? LIMIT 1', [req.params.id]);
  if (!p) return bad(res, 'Payment not found.', 404);

  await withTransaction(async (tx) => {
    await tx.execute('UPDATE payments SET status = ? WHERE id = ?', [decision, p.id]);
    if (decision !== 'CONFIRMED') return;
    if (p.ghotokId) {
      // A matchmaker's plan is their active-profile limit.
      await tx.execute('UPDATE ghotoks SET tier = ?, activeProfileLimit = ? WHERE id = ?', [p.tier, TIER_LIMIT[p.tier] || 20, p.ghotokId]);
      return;
    }
    // A family's Premium. Confirming while one is still running extends it
    // from its own expiry rather than from today — the days already paid for
    // are not thrown away (see expiryFor).
    const current = await queryOne('SELECT * FROM member_subscriptions WHERE userId = ? LIMIT 1', [p.userId]);
    const expiresAt = expiryFor(p.billing, current?.status === 'ACTIVE' ? current.expiresAt : null);
    if (current) {
      await tx.execute(
        "UPDATE member_subscriptions SET tier = ?, billing = ?, status = 'ACTIVE', expiresAt = ?, paymentId = ? WHERE id = ?",
        [p.tier, p.billing, expiresAt, p.id, current.id]
      );
    } else {
      await tx.execute(
        "INSERT INTO member_subscriptions (userId, tier, billing, status, expiresAt, paymentId) VALUES (?, ?, ?, 'ACTIVE', ?, ?)",
        [p.userId, p.tier, p.billing, expiresAt, p.id]
      );
    }
  });
  return res.json({ ok: true, status: decision });
});

export default router;
