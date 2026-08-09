// SongiSathi Ghotok — MySQL connection pool (mysql2, no ORM).
//
// One shared pool for the whole API. DATABASE_URL is a standard MySQL URI:
//   mysql://USER:PASSWORD@HOST:PORT/DATABASE
//
// Queries use positional `?` placeholders and return plain row objects.

import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

const pool = mysql.createPool({
  uri: url,
  waitForConnections: true,
  connectionLimit: 10,
  // Keep DATETIME columns as JS Date objects (so expiry comparisons work),
  // and decimals as numbers.
  dateStrings: false,
  decimalNumbers: true,
});

// Run a query and return just the rows.
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Run a query and return the first row (or null).
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// Run `fn` inside a transaction, passing it a dedicated connection.
// The connection exposes the same execute() API; commit/rollback are automatic.
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Convenience: INSERT via a transaction connection, returning the new id.
export async function insert(conn, sql, params = []) {
  const [res] = await conn.execute(sql, params);
  return res.insertId;
}

export default pool;
