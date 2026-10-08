// backend/scripts/import-zones.ts — load council-zone polygons from GeoJSON.
//
//   npm run zones            # uses backend/data/zones/ta-2026-clipped.geojson
//   tsx scripts/import-zones.ts <file.geojson> [--tolerance 0.001]
//
// Default file: Stats NZ "Territorial Authority 2026 (clipped)" — fetched from
// the open ArcGIS FeatureServer (see data/zones/README.md). One council row is
// created per territorial authority; alert_emails/alert_sms start empty.
// Idempotent: ON CONFLICT refreshes the boundary.
import { readFileSync } from 'node:fs';
import { pool } from '../src/db.js';

const file = process.argv[2] ?? 'data/zones/ta-2026-clipped.geojson';
const tolIdx = process.argv.indexOf('--tolerance');
const tolerance = tolIdx > 0 ? Number(process.argv[tolIdx + 1]) : 0.0005;
if (!Number.isFinite(tolerance) || tolerance < 0) {
  console.error('--tolerance must be a non-negative number (degrees; ~0.0005 ≈ 50 m)');
  process.exit(1);
}

interface Feature {
  properties: Record<string, unknown>;
  geometry: unknown;
}

async function main() {
  const fc = JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] };
  if (!fc.features?.length) throw new Error(`${file}: no features`);
  console.log(`importing ${fc.features.length} zones from ${file} (simplify tolerance ${tolerance}°)`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let imported = 0;
    for (const f of fc.features) {
      const name = String(f.properties.TA2026_V1_00_NAME ?? f.properties.name ?? '');
      if (!name || name === 'Area Outside Territorial Authority') continue;
      const { rows } = await client.query(
        `SELECT ST_IsValid(g) AS valid, ST_NPoints(g) AS npts
         FROM (SELECT ST_SimplifyPreserveTopology(ST_GeomFromGeoJSON($1), $2) AS g) s`,
        [JSON.stringify(f.geometry), tolerance],
      );
      if (!rows[0].valid) {
        console.warn(`  SKIP ${name}: simplified geometry invalid`);
        continue;
      }
      const { rows: council } = await client.query(
        `INSERT INTO councils (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name],
      );
      await client.query(
        `INSERT INTO council_zones (council_id, name, boundary)
         SELECT $1, 'All areas', ST_SimplifyPreserveTopology(ST_GeomFromGeoJSON($2), $3)
         ON CONFLICT (council_id, name) DO UPDATE
           SET boundary = ST_SimplifyPreserveTopology(ST_GeomFromGeoJSON($2), $3)`,
        [council[0].id, JSON.stringify(f.geometry), tolerance],
      );
      console.log(`  ${name} — ${rows[0].npts} pts`);
      imported++;
    }
    await client.query('COMMIT');
    console.log(`done — ${imported} zones imported`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
