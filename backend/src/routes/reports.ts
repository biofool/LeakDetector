// backend/src/routes/reports.ts — spec §3. Mount order matters: /nearby
// is registered before /:id.
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, withTx } from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireStaff, optionalStaff, canAccess } from '../middleware/staffAuth.js';
import { computeSLA } from '../services/sla.js';
import { zoneForPoint } from '../services/zones.js';
import { findNearby, effectiveRadius } from '../services/duplicates.js';
import { processPhoto, photoUrl } from '../services/photos.js';
import { queue } from '../services/outbox.js';
import { toReport } from '../util/serialize.js';
import { toRef } from '../util/ref.js';
import { LOCATIONS, SEVERITIES, STATUSES, OPEN_STATUSES } from '../types.js';
import type { Location, Severity, Status, ReportRow, PhotoRow } from '../types.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3 },
});

const REPORT_SELECT = `
  SELECT r.*, ST_Y(r.geom) AS lat, ST_X(r.geom) AS lng,
         z.name AS zone_name, z.council_id, c.name AS council_name,
         c.entity, c.contact_phone, c.contact_form_url, c.contact_app
  FROM reports r
  JOIN council_zones z ON z.id = r.council_zone_id
  JOIN councils c ON c.id = z.council_id`;

const NEARBY_OPEN_COL = `, (SELECT count(*) FROM reports n WHERE n.id <> r.id AND n.is_duplicate_of IS NULL
         AND n.status IN ('received','investigating','contractor_assigned')
         AND ST_DWithin(n.geom::geography, r.geom::geography, 30)) AS nearby_open_count`;

async function photosOf(reportId: number): Promise<PhotoRow[]> {
  const { rows } = await query('SELECT * FROM report_photos WHERE report_id = $1 ORDER BY id', [reportId]);
  return rows;
}

// ---------------------------------------------------------------- POST /
const createSchema = z.object({
  category: z.enum(LOCATIONS),
  severity: z.enum(SEVERITIES),
  description: z.string().max(1000).optional().default(''),
  lat: z.coerce.number().min(-48, 'lat must be between -48 and -34').max(-34, 'lat must be between -48 and -34'),
  lng: z.coerce.number().min(166, 'lng must be between 166 and 179').max(179, 'lng must be between 166 and 179'),
  accuracy_m: z.coerce.number().min(0).optional(),
  reporter_name: z.string().max(100).optional(),
  reporter_contact: z.string().max(200).optional(),
});

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const NZ_MOBILE = /^(\+?64|0)2\d{7,9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalise a NZ mobile to E.164; emails pass through. Null → unchanged. */
function normaliseContact(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (EMAIL.test(v)) return v;
  const digits = v.replace(/[\s-]/g, '');
  if (NZ_MOBILE.test(digits)) {
    const rest = digits.startsWith('+') ? digits.slice(3) : digits.startsWith('64') ? digits.slice(2) : digits.slice(1);
    return `+64${rest}`;
  }
  throw new ApiError(400, 'validation_failed', 'reporter_contact must be an email or NZ mobile');
}

router.post(
  '/',
  rateLimit('create-report', 5, 60 * 60 * 1000),
  upload.array('photos', 3),
  async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      for (const f of req.files as Express.Multer.File[]) {
        if (!IMAGE_TYPES.has(f.mimetype)) {
          throw new ApiError(415, 'unsupported_type', `photo type ${f.mimetype} not supported`);
        }
      }
      const contact = normaliseContact(input.reporter_contact);
      const zone = await zoneForPoint(input.lng, input.lat);
      if (!zone) {
        throw new ApiError(422, 'outside_service_area', 'no partner council covers this location');
      }
      const sla_due_at = computeSLA(input.severity, input.category, new Date());

      const report = await withTx(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO reports (geom, gps_accuracy_m, category, location_type, severity, description,
                                reporter_name, reporter_contact, council_zone_id, sla_due_at)
           VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [input.lng, input.lat, input.accuracy_m ?? null, input.category, input.severity,
           input.description, input.reporter_name ?? null, contact, zone.id, sla_due_at],
        );
        const r = rows[0] as ReportRow;
        const id = Number(r.id);
        await client.query(
          'INSERT INTO report_status_history (report_id, from_status, to_status) VALUES ($1, NULL, $2)',
          [id, 'received'],
        );
        const ref = toRef(id);
        const tracking_url = `${config.publicBaseUrl}/r/${id}`;

        const files = (req.files as Express.Multer.File[]) ?? [];
        for (const f of files) {
          let p;
          try {
            p = await processPhoto(id, f.buffer);
          } catch {
            throw new ApiError(415, 'unsupported_type', 'photo could not be processed — is it a real image?');
          }
          await client.query(
            `INSERT INTO report_photos (report_id, storage_key, thumb_key, content_type, width, height, bytes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, p.storage_key, p.thumb_key, p.content_type, p.width, p.height, p.bytes],
          );
        }

        // Reporter is CC'd on the authority alert when the contact is an
        // email address (#24). payload.cc → Postmark Cc in the worker.
        const cc = contact?.includes('@') ? contact : undefined;
        const payload = { ref, category: input.category, severity: input.severity, tracking_url, zone: zone.name, sla_due_at, cc };
        // Zones with no alert_emails fall back to ALERT_FALLBACK_EMAIL if set;
        // otherwise no authority alert is queued (#25).
        const alertEmails = zone.alert_emails.length
          ? zone.alert_emails
          : config.alertFallbackEmail ? [config.alertFallbackEmail] : [];
        for (const email of alertEmails) {
          await queue(client, { report_id: id, channel: 'email', recipient: email, template: 'new_report', payload, dedupe_key: `new_report:${id}:${email}` });
        }
        // Email-only notifications: phone-only reporters get no receipt.
        if (contact?.includes('@')) {
          await queue(client, {
            report_id: id,
            channel: 'email',
            recipient: contact,
            template: 'reporter_receipt',
            payload,
          });
        }
        return { id, ref, tracking_url };
      });

      const duplicates = await findNearby(input.lat, input.lng, {
        radiusM: 30, accuracyM: input.accuracy_m, excludeId: report.id,
      });
      res.status(201).json({
        id: report.id,
        ref: report.ref,
        status: 'received',
        council_zone: {
          id: zone.id,
          name: zone.name,
          council: zone.council_name,
          contact: {
            entity: zone.entity,
            phone: zone.contact_phone,
            form_url: zone.contact_form_url,
            app: zone.contact_app,
          },
        },
        sla_due_at,
        tracking_url: report.tracking_url,
        possible_duplicates: duplicates.map((d) => ({ id: d.id, distance_m: d.distance_m, status: d.status })),
      });
    } catch (e) {
      next(e);
    }
  },
);

// ----------------------------------------------------------- GET /nearby
const nearbySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius_m: z.coerce.number().optional(),
  accuracy_m: z.coerce.number().optional(),
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

// -------------------------------------------- PATCH /:id/photos/:photoId
// Staff photo moderation — hide photos showing faces, plates, etc. [D-07]
router.patch('/:id(\\d+)/photos/:photoId(\\d+)', requireStaff, async (req, res, next) => {
  try {
    const body = z.object({ is_hidden: z.boolean() }).parse(req.body);
    const { rows } = await query(`${REPORT_SELECT} WHERE r.id = $1`, [req.params.id]);
    const row = rows[0] as ReportRow | undefined;
    if (!row) throw new ApiError(404, 'not_found', 'report not found');
    if (!canAccess(req.user!, row.council_id!)) {
      throw new ApiError(403, 'forbidden', 'report belongs to another council');
    }
    const upd = await query(
      'UPDATE report_photos SET is_hidden = $1 WHERE id = $2 AND report_id = $3 RETURNING id, is_hidden',
      [body.is_hidden, req.params.photoId, req.params.id],
    );
    if (!upd.rowCount) throw new ApiError(404, 'not_found', 'photo not found on this report');
    res.json({ id: Number(upd.rows[0].id), is_hidden: upd.rows[0].is_hidden });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------- POST /:id/confirm
router.post(
  '/:id(\\d+)/confirm',
  rateLimit('confirm', 10, 60 * 60 * 1000),
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

// ------------------------------------------------------------- PATCH /:id
const TRANSITIONS: Record<Status, Status[]> = {
  received: ['investigating', 'contractor_assigned', 'resolved', 'closed_private'],
  investigating: ['contractor_assigned', 'resolved', 'closed_private'],
  contractor_assigned: ['investigating', 'resolved', 'closed_private'],
  resolved: ['investigating'],
  closed_private: ['investigating'],
};

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  location_type: z.enum(LOCATIONS).optional(),
  verified: z.boolean().optional(),
  is_duplicate_of: z.number().int().nullable().optional(),
  public_note: z.string().max(500).nullable().optional(),
});

router.patch('/:id(\\d+)', requireStaff, async (req, res, next) => {
  try {
    const patch = patchSchema.parse(req.body);
    const { rows } = await query(`${REPORT_SELECT} WHERE r.id = $1`, [req.params.id]);
    const row = rows[0] as ReportRow | undefined;
    if (!row) throw new ApiError(404, 'not_found', 'report not found');
    if (!canAccess(req.user!, row.council_id!)) {
      throw new ApiError(403, 'forbidden', 'report belongs to another council');
    }

    if (patch.status && patch.status !== row.status && !TRANSITIONS[row.status].includes(patch.status)) {
      throw new ApiError(409, 'invalid_transition', `cannot move ${row.status} → ${patch.status}`);
    }

    const updated = await withTx(async (client) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };

      if (patch.status && patch.status !== row.status) {
        set('status', patch.status);
        const closing = patch.status === 'resolved' || patch.status === 'closed_private';
        sets.push(closing ? 'resolved_at = now()' : 'resolved_at = NULL');
      }
      if (patch.severity !== undefined) set('severity', patch.severity);
      if (patch.location_type !== undefined) set('location_type', patch.location_type);
      if (patch.severity !== undefined || patch.location_type !== undefined) {
        const sev = (patch.severity ?? row.severity) as Severity;
        const loc = (patch.location_type ?? row.location_type) as Location;
        set('sla_due_at', computeSLA(sev, loc, new Date(row.created_at)));
      }
      if (patch.verified !== undefined) set('verified', patch.verified);
      if (patch.public_note !== undefined) set('public_note', patch.public_note);
      if (patch.is_duplicate_of !== undefined) {
        if (patch.is_duplicate_of !== null) {
          const { rows: t } = await client.query(`${REPORT_SELECT} WHERE r.id = $1`, [patch.is_duplicate_of]);
          const target = t[0];
          if (!target || target.id === row.id || target.is_duplicate_of !== null || target.council_id !== row.council_id) {
            throw new ApiError(422, 'invalid_duplicate_target', 'duplicate target must be a non-duplicate report in the same council');
          }
          // No chains: this report can't become a duplicate while other
          // reports already point at IT as a duplicate.
          const { rows: kids } = await client.query(
            'SELECT 1 FROM reports WHERE is_duplicate_of = $1 LIMIT 1',
            [row.id],
          );
          if (kids.length) {
            throw new ApiError(422, 'invalid_duplicate_target', 'report already has duplicates linked to it — unlink them first');
          }
        }
        set('is_duplicate_of', patch.is_duplicate_of);
      }
      if (!sets.length) throw new ApiError(400, 'validation_failed', 'no fields to update');

      vals.push(row.id);
      const { rows: out } = await client.query(
        `UPDATE reports SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`,
        vals,
      );
      const id = Number(out[0].id);
      if (patch.status && patch.status !== row.status) {
        await client.query(
          'INSERT INTO report_status_history (report_id, from_status, to_status, changed_by) VALUES ($1, $2, $3, $4)',
          [id, row.status, patch.status, req.user!.id],
        );
      }
      const ref = toRef(id);

      // Reporter messaging on closure — only on an actual status change,
      // not on re-PATCH of an already-closed report.
      const closing =
        (patch.status === 'resolved' || patch.status === 'closed_private') && patch.status !== row.status;
      if (closing && row.reporter_contact?.includes('@')) {
        await queue(client, {
          report_id: id,
          channel: 'email',
          recipient: row.reporter_contact,
          template: patch.status === 'resolved' ? 'reporter_resolved' : 'reporter_private',
          payload: { ref },
        });
      }
      // Cascade the same status to marked duplicates + notify their reporters.
      // Spec assigns this to the worker; doing it in this tx is atomic.
      if (closing) {
        const { rows: dups } = await client.query(
          `UPDATE reports SET status = $1, resolved_at = now()
           WHERE is_duplicate_of = $2 AND status NOT IN ('resolved','closed_private')
           RETURNING id, reporter_contact, status AS _from`,
          [patch.status, id],
        );
        for (const d of dups) {
          await client.query(
            'INSERT INTO report_status_history (report_id, from_status, to_status, changed_by) VALUES ($1, $2, $3, $4)',
            [Number(d.id), d._from, patch.status, req.user!.id],
          );
        }
        for (const d of dups) {
          if (d.reporter_contact?.includes('@')) {
            await queue(client, {
              report_id: Number(d.id),
              channel: 'email',
              recipient: d.reporter_contact,
              template: patch.status === 'resolved' ? 'reporter_resolved' : 'reporter_private',
              payload: { ref: toRef(d.id), parent_ref: ref },
            });
          }
        }
      }
      return id;
    });

    const { rows: final } = await query(
      `${REPORT_SELECT.replace('SELECT r.*,', `SELECT r.*${NEARBY_OPEN_COL},`)} WHERE r.id = $1`,
      [updated],
    );
    res.json(toReport(final[0], await photosOf(updated), true));
  } catch (e) {
    next(e);
  }
});

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
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
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
