// backend/src/services/duplicates.ts — spec §5. ST_DWithin on geography is
// metres and uses reports_geog_gix; the cast must match the index exactly.
import { query } from '../db.js';

export interface NearbyResult {
  id: number;
  category: string;
  severity: string;
  status: string;
  distance_m: number;
  confirmation_count: number;
  created_at: string;
  resolved_at: string | null;
  thumb_key: string | null;
}

export interface NearbyOptions {
  radiusM?: number;
  accuracyM?: number;
  excludeId?: number;
}

/** Effective radius widens when GPS accuracy is poor [D-13]. */
export function effectiveRadius(radiusM = 30, accuracyM?: number): number {
  const clamped = Math.min(Math.max(radiusM, 10), 200);
  return Math.max(clamped, Math.min(accuracyM ?? 0, 100));
}

export async function findNearby(lat: number, lng: number, opts: NearbyOptions = {}): Promise<NearbyResult[]> {
  const radius = effectiveRadius(opts.radiusM, opts.accuracyM);
  const { rows } = await query(
    `SELECT r.id, r.category, r.severity, r.status, r.created_at, r.resolved_at, r.confirmation_count,
            ST_Distance(r.geom::geography,
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m,
            (SELECT p.thumb_key FROM report_photos p
              WHERE p.report_id = r.id AND NOT p.is_hidden ORDER BY p.id LIMIT 1) AS thumb_key
     FROM reports r
     WHERE ST_DWithin(r.geom::geography,
                      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                      $3)
       AND r.is_duplicate_of IS NULL
       AND ( r.status IN ('received','investigating','contractor_assigned')
             OR r.resolved_at > now() - interval '7 days' )
       AND ($4::bigint IS NULL OR r.id <> $4)
     ORDER BY distance_m
     LIMIT 10`,
    [lng, lat, radius, opts.excludeId ?? null],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), distance_m: Math.round(r.distance_m * 10) / 10 }));
}
