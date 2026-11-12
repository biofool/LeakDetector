// backend/src/routes/reports_public.ts — spec §3: public read endpoints
// (GET /nearby, GET /:id, GET /) + POST /:id/confirm. Mount order matters:
// /nearby is registered before /:id. Mounted by reports.ts.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { ApiError } from '../middleware/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { originCheck } from '../middleware/originCheck.js';
import { optionalStaff, canAccess } from '../middleware/staffAuth.js';
import { findNearby, effectiveRadius } from '../services/duplicates.js';
import { photoUrl } from '../services/photos.js';
import { toReport } from '../util/serialize.js';
import { toRef } from '../util/ref.js';
import { LOCATIONS, SEVERITIES, STATUSES, OPEN_STATUSES } from '../types.js';
import { REPORT_SELECT, NEARBY_OPEN_COL, photosOf } from './reports_shared.js';

const router = Router();

// ----------------------------------------------------------- GET /nearby
// Bounds + finite: lat=200 or 1e999 (→ Infinity through coerce) would throw
// inside ST_MakePoint::geography and surface as a 500 (#57).
const nearbySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  radius_m: z.coerce.number().finite().positive().optional(),
  accuracy_m: z.coerce.number().finite().nonnegative().optional(),
});

router.get(
  '/nearby',
  rateLimit('nearby', 60, 60 * 1000),
  async (req, res, next) => {
    try {
      const q = nearbySchema.parse(req.query);
      const radius = effectiveRadius(q.radius_m ?? 30, q.accuracy_m);
      const results = await findNearby(q.lat, q.lng, { radiusM: q.radius_m ?? 30, accuracyM: q.accuracy_m });
      res.json({
        radius_m: radius,
        results: results.map((r) => ({
          id: r.id,
          ref: toRef(r.id),
          category: r.category,
          severity: r.severity,
          status: r.status,
          distance_m: r.distance_m,
          confirmation_count: r.confirmation_count,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          thumb_url: r.thumb_key ? photoUrl(r.thumb_key) : null,
        })),
      });
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------- GET /:id
router.get('/:id(\\d+)', optionalStaff, async (req, res, next) => {
  try {
    const { rows } = await query(`${REPORT_SELECT} WHERE r.id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'report not found');
    const staff = Boolean(req.user && canAccess(req.user, row.council_id));
    const { rows: history } = await query(
      'SELECT from_status, to_status, changed_at FROM report_status_history WHERE report_id = $1 ORDER BY changed_at, id',
      [req.params.id],
    );
    res.json(toReport(row, await photosOf(row.id), staff, history));
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------- POST /:id/confirm
router.post(
  '/:id(\\d+)/confirm',
  rateLimit('confirm', 10, 60 * 60 * 1000),
  originCheck,
  async (req, res, next) => {
    try {
      const { rows } = await query('SELECT id, status, is_duplicate_of FROM reports WHERE id = $1', [req.params.id]);
      const r = rows[0];
      if (!r) throw new ApiError(404, 'not_found', 'report not found');
      if (r.is_duplicate_of !== null) {
        throw new ApiError(422, 'is_duplicate', 'this report is marked as a duplicate — confirm the original instead');
      }
      if (r.status === 'resolved' || r.status === 'closed_private') {
        throw new ApiError(409, 'already_resolved', 'this report is already resolved');
      }
      const upd = await query(
        'UPDATE reports SET confirmation_count = confirmation_count + 1 WHERE id = $1 RETURNING id, confirmation_count',
        [req.params.id],
      );
      res.json({ id: Number(upd.rows[0].id), confirmation_count: upd.rows[0].confirmation_count });
    } catch (e) {
      next(e);
    }
  },
);

// ---------------------------------------------------------------- GET /
router.get('/', optionalStaff, async (req, res, next) => {
  try {
    // req.query values can be string | string[] — normalise to one string
    const one = (v: unknown): string | undefined =>
      Array.isArray(v) ? String(v[v.length - 1]) : v === undefined ? undefined : String(v);
    const q: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.query)) q[k] = one(v);
    const staffScoped = req.user && req.user.role !== 'platform_admin';
    const isStaff = Boolean(req.user);
    const bad = (msg: string) => new ApiError(400, 'validation_failed', msg);

    const where: string[] = [];
    const vals: unknown[] = [];
    const cond = (sql: string, v?: unknown) => {
      if (v !== undefined) { vals.push(v); where.push(sql.replace('?', `$${vals.length}`)); }
      else where.push(sql);
    };
    const csv = (s?: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null);

    const statuses = csv(q.status);
    if (statuses?.length) {
      if (statuses.some((s) => !(STATUSES as readonly string[]).includes(s))) throw bad(`status must be one of ${STATUSES.join(', ')}`);
      cond('r.status = ANY(?::report_status[])', statuses);
    }
    const categories = csv(q.category);
    if (categories?.length) {
      if (categories.some((s) => !(LOCATIONS as readonly string[]).includes(s))) throw bad(`category must be one of ${LOCATIONS.join(', ')}`);
      cond('r.category = ANY(?::leak_location[])', categories);
    }
    const severities = csv(q.severity);
    if (severities?.length) {
      if (severities.some((s) => !(SEVERITIES as readonly string[]).includes(s))) throw bad(`severity must be one of ${SEVERITIES.join(', ')}`);
      cond('r.severity = ANY(?::leak_severity[])', severities);
    }
    if (q.council_zone_id) {
      const zid = Number(q.council_zone_id);
      if (!Number.isInteger(zid)) throw bad('council_zone_id must be an integer');
      cond('r.council_zone_id = ?', zid);
    }
    if (q.updated_since) {
      if (Number.isNaN(Date.parse(q.updated_since))) throw bad('updated_since must be an ISO timestamp');
      cond('r.updated_at > ?', q.updated_since);
    }
    if (q.bbox) {
      const parts = q.bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) {
        throw bad('bbox must be minLng,minLat,maxLng,maxLat');
      }
      vals.push(...parts);
      where.push(`r.geom && ST_MakeEnvelope($${vals.length - 3}, $${vals.length - 2}, $${vals.length - 1}, $${vals.length}, 4326)`);
    }
    const SLA_FILTERS = ['on_track', 'due_soon', 'breached'];
    if (q.sla !== undefined && !SLA_FILTERS.includes(q.sla)) throw bad(`sla must be one of ${SLA_FILTERS.join(', ')}`);
    const open = `r.status IN ('${OPEN_STATUSES.join("','")}') AND r.is_duplicate_of IS NULL`;
    if (q.sla === 'breached') where.push(`${open} AND r.sla_due_at < now()`);
    if (q.sla === 'due_soon') {
      where.push(`${open} AND r.sla_due_at >= now() AND r.sla_due_at - now() <= LEAST(interval '2 hours', (r.sla_due_at - r.created_at) * 0.25)`);
    }
    if (q.sla === 'on_track') {
      where.push(`${open} AND r.sla_due_at - now() > LEAST(interval '2 hours', (r.sla_due_at - r.created_at) * 0.25)`);
    }
    if (q.include_duplicates !== 'true') where.push('r.is_duplicate_of IS NULL');
    if (!isStaff) {
      where.push(`(r.status NOT IN ('resolved','closed_private') OR r.resolved_at > now() - interval '7 days')`);
    }
    if (staffScoped) cond('z.council_id = ?', req.user!.council_id);

    const pageNum = Number(q.page ?? 1);
    const limitNum = Number(q.limit ?? 50);
    if (!Number.isFinite(pageNum) || pageNum < 1) throw bad('page must be a positive integer');
    if (!Number.isFinite(limitNum) || limitNum < 1) throw bad('limit must be a positive integer');
    const page = Math.floor(pageNum);
    const limit = Math.min(Math.floor(limitNum), 200);
    const SORTS = ['sla_due_at', '-created_at'];
    if (q.sort !== undefined && !SORTS.includes(q.sort)) throw bad(`sort must be one of ${SORTS.join(', ')}`);
    if (q.format !== undefined && !['json', 'geojson'].includes(q.format)) throw bad('format must be json or geojson');
    const orderBy = q.sort === 'sla_due_at' || (!q.sort && isStaff) ? 'r.sla_due_at ASC' : 'r.created_at DESC';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const extraCols = isStaff ? NEARBY_OPEN_COL : '';

    const [countRes, listRes] = await Promise.all([
      query(
        `SELECT count(*) AS n FROM reports r JOIN council_zones z ON z.id = r.council_zone_id ${whereSql}`,
        vals,
      ),
      query(
        `${REPORT_SELECT.replace('SELECT r.*,', `SELECT r.*${extraCols},`)} ${whereSql} ORDER BY ${orderBy} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
        [...vals, limit, (page - 1) * limit],
      ),
    ]);

    if (q.format === 'geojson') {
      res.json({
        type: 'FeatureCollection',
        features: listRes.rows.map((r) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
          properties: { id: Number(r.id), ref: toRef(r.id), category: r.category, severity: r.severity, status: r.status },
        })),
      });
      return;
    }

    res.json({
      page,
      limit,
      total: Number(countRes.rows[0].n),
      results: listRes.rows.map((r) => toReport(r, [], Boolean(isStaff && canAccess(req.user!, r.council_id)))),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
