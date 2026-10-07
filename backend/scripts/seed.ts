// backend/scripts/seed.ts — dev seed: one demo council, one NZ-wide zone,
// one staff login. Idempotent. `npm run seed`.
//   staff login: staff@example.govt.nz / password123
import argon2 from 'argon2';
import { pool } from '../src/db.js';

// Rough NZ mainland bbox as a MultiPolygon — dev only, replace with real
// council boundaries (LINZ/Stats NZ) for a pilot.
const NZ_BBOX = 'SRID=4326;MULTIPOLYGON(((166 -48, 179 -48, 179 -34, 166 -34, 166 -48)))';

async function main() {
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
       VALUES ($1, 'Citywide', ST_GeomFromEWKT($2), '{duty@example.govt.nz}')
       ON CONFLICT (council_id, name) DO NOTHING`,
      [councilId, NZ_BBOX],
    );
    await client.query(
      `INSERT INTO users (email, password_hash, display_name, role, council_id)
       VALUES ('staff@example.govt.nz', $1, 'Demo Staff', 'council_admin', $2)
       ON CONFLICT (lower(email)) DO NOTHING`,
      [await argon2.hash('password123'), councilId],
    );
    await client.query('COMMIT');
    console.log('seeded: Demo City Council / Citywide zone / staff@example.govt.nz (password123)');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
