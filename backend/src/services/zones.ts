// backend/src/services/zones.ts — point-in-polygon zone lookup (spec §2).
// ST_MakePoint takes (lng, lat) — longitude first.
import { query } from '../db.js';

export interface Zone {
  id: number;
  name: string;
  council_id: number;
  council_name: string;
  alert_emails: string[];
}

/** Smallest covering zone wins when zones overlap. Null when uncovered [D-11]. */
export async function zoneForPoint(lng: number, lat: number): Promise<Zone | null> {
  const { rows } = await query(
    `SELECT z.id, z.name, z.council_id, c.name AS council_name, z.alert_emails
     FROM council_zones z
     JOIN councils c ON c.id = z.council_id
     WHERE ST_Covers(z.boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
     ORDER BY ST_Area(z.boundary) ASC
     LIMIT 1`,
    [lng, lat],
  );
  return rows[0] ?? null;
}
