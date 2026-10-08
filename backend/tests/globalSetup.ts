// backend/tests/globalSetup.ts — create a fresh PostGIS test DB, migrate,
// seed a Wellington-only zone so outside_service_area is testable.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import argon2 from 'argon2';

const BASE = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/leakdetector';
const TEST_DB = 'leakdetector_test';
const adminUrl = BASE.replace(/\/[^/?]+(\?|$)/, `/postgres$1`);
export const TEST_DB_URL = BASE.replace(/\/[^/?]+(\?|$)/, `/${TEST_DB}$1`);

// Wellington-ish bbox — dev/test only.
const WLG = 'SRID=4326;MULTIPOLYGON(((174.6 -41.5, 175.0 -41.5, 175.0 -41.1, 174.6 -41.1, 174.6 -41.5)))';

export default async function globalSetup() {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  const dir = join(process.cwd(), 'migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(join(dir, f), 'utf8'));
  }
  const { rows } = await client.query(
    `INSERT INTO councils (name, entity, contact_phone, contact_form_url, contact_app)
     VALUES ('Demo City Council', 'Demo Water Services', '0800 555 123', 'https://example.govt.nz/report-leak', 'Antenno')
     RETURNING id`,
  );
  await client.query(
    `INSERT INTO council_zones (council_id, name, boundary, alert_emails)
     VALUES ($1, 'Citywide', ST_GeomFromEWKT($2), '{duty@example.govt.nz}')`,
    [rows[0].id, WLG],
  );
  await client.query(
    `INSERT INTO users (email, password_hash, display_name, role, council_id)
     VALUES ('staff@example.govt.nz', $1, 'Demo Staff', 'council_admin', $2)`,
    [await argon2.hash('password123'), rows[0].id],
  );
  await client.end();
}
