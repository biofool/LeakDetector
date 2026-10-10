// backend/scripts/seed.ts — dev seed: one demo council, one NZ-wide zone,
// one staff login. Idempotent. `npm run seed`.
// Defaults: staff@example.govt.nz / password123 — override with
// SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_DUTY_EMAIL.
// SEED_DEMO=0 skips everything (prod: deploy/remote-setup.sh sets it so a
// deploy never recreates the demo zone or a default-password login, #31).
import argon2 from 'argon2';
import { pool } from '../src/db.js';

// Rough NZ mainland bbox as a MultiPolygon — dev only, replace with real
// council boundaries (LINZ/Stats NZ) for a pilot.
const NZ_BBOX = 'SRID=4326;MULTIPOLYGON(((166 -48, 179 -48, 179 -34, 166 -34, 166 -48)))';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'staff@example.govt.nz';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'password123';
const DUTY_EMAIL = process.env.SEED_DUTY_EMAIL ?? 'duty@example.govt.nz';

async function main() {
  if (process.env.SEED_DEMO === '0') {
    console.warn('[seed] SEED_DEMO=0 — skipping demo council, Citywide zone and demo staff login');
    await pool.end();
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: council } = await client.query(
      `INSERT INTO councils (name) VALUES ('Demo City Council')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    );
    const councilId = council[0].id;
    await client.query(
      `INSERT INTO council_zones (council_id, name, boundary, alert_emails)
       VALUES ($1, 'Citywide', ST_GeomFromEWKT($2), $3::text[])
       ON CONFLICT (council_id, name) DO NOTHING`,
      [councilId, NZ_BBOX, [DUTY_EMAIL]],
    );
    await client.query(
      `INSERT INTO users (email, password_hash, display_name, role, council_id)
       VALUES ($2, $1, 'Demo Staff', 'council_admin', $3)
       ON CONFLICT (lower(email)) DO NOTHING`,
      [await argon2.hash(ADMIN_PASSWORD), ADMIN_EMAIL, councilId],
    );
    await client.query('COMMIT');
    console.log(`seeded: Demo City Council / Citywide zone / ${ADMIN_EMAIL}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
