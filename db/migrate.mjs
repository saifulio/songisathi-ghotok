// SongiSathi Ghotok — schema runner (replaces `prisma migrate`).
//
//   node db/migrate.mjs           apply db/schema.sql (idempotent: CREATE TABLE IF NOT EXISTS)
//   node db/migrate.mjs --drop    drop every table first, then re-apply (a clean reset)
//
// Uses a one-off connection with multipleStatements enabled so the whole .sql
// file runs in a single call.

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, 'schema.sql');

// Every table, children-first, so DROP order never trips a foreign key.
const TABLES = [
  'messages', 'conversations',
  'activity_log', 'testimonials', 'report_evidence', 'reports',
  'verification_checks', 'verifications', 'pricing_tiers', 'payments',
  'marriages', 'management_requests', 'interests', 'match_factors', 'match_suggestions',
  'screening_responses', 'screening_options', 'screening_questions',
  'profile_preferences', 'profiles', 'password_reset_tokens',
  'email_verification_tokens', 'guardians', 'ghotoks', 'users',
];

async function main() {
  const drop = process.argv.includes('--drop');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  // The database itself may not exist yet, so connect without it first and
  // create it (Prisma used to do this), then reconnect with it selected.
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!dbName) throw new Error('DATABASE_URL has no database name.');

  const server = await mysql.createConnection({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  });
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await server.end();

  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
  try {
    if (drop) {
      console.log('Dropping existing tables…');
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of TABLES) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log('Applying schema…');
    const sql = await readFile(schemaPath, 'utf8');
    await conn.query(sql);
    console.log('Schema applied.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
