// backend/src/db.ts — pg pool + transaction helper.
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

/** Run fn inside a transaction; commits on success, rolls back on throw. */
export async function withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    // Unguarded ROLLBACK on a dead connection would mask the real error (#57).
    await client.query('ROLLBACK').catch((re) => console.warn('[db] ROLLBACK failed:', re));
    throw e;
  } finally {
    client.release();
  }
}
