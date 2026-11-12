// backend/src/routes/reports_shared.ts — query fragments + helpers shared by
// the reports route modules (reports_create/public/staff).
import { query } from '../db.js';
import type { PhotoRow } from '../types.js';

export const REPORT_SELECT = `
  SELECT r.*, ST_Y(r.geom) AS lat, ST_X(r.geom) AS lng,
         z.name AS zone_name, z.council_id, c.name AS council_name,
         c.entity, c.contact_phone, c.contact_form_url, c.contact_app,
         c.submission_channel, c.channel_config
  FROM reports r
  JOIN council_zones z ON z.id = r.council_zone_id
  JOIN councils c ON c.id = z.council_id`;

export const NEARBY_OPEN_COL = `, (SELECT count(*) FROM reports n WHERE n.id <> r.id AND n.is_duplicate_of IS NULL
         AND n.status IN ('received','investigating','contractor_assigned')
         AND ST_DWithin(n.geom::geography, r.geom::geography, 30)) AS nearby_open_count`;

export async function photosOf(reportId: number): Promise<PhotoRow[]> {
  const { rows } = await query('SELECT * FROM report_photos WHERE report_id = $1 ORDER BY id', [reportId]);
  return rows;
}
