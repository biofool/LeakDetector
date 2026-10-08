// backend/src/routes/volunteers.ts — volunteer "power user" signup (#37).
// No accounts: email + token unsubscribe, matching the reporter model.
// Privacy: volunteer contact details are staff-only — no public response
// returns names/emails, and signup answers identically whether the email is
// new or already registered.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireStaff } from '../middleware/staffAuth.js';
import { zoneForPoint } from '../services/zones.js';
import { HELP_TYPES } from '../types.js';

const router = Router();

// ------------------------------------------------------------------ POST /
const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  // Zone by id (dropdown) or by point (auto-detect) — one is required.
  council_zone_id: z.coerce.number().int().optional(),
  lat: z.coerce.number().min(-48).max(-34).optional(),
  lng: z.coerce.number().min(166).max(179).optional(),
  help_types: z.array(z.enum(HELP_TYPES)).min(1),
  note: z.string().trim().max(500).optional(),
  consent: z.literal(true),
});

router.post(
  '/',
  rateLimit('volunteer-signup', 10, 60 * 60 * 1000),
  async (req, res, next) => {
    try {
      const input = signupSchema.parse(req.body);
      let zoneId = input.council_zone_id;
      if (zoneId !== undefined) {
        const { rows } = await query('SELECT 1 FROM council_zones WHERE id = $1', [zoneId]);
        if (!rows.length) throw new ApiError(422, 'unknown_zone', 'no council zone with that id');
      } else if (input.lat !== undefined && input.lng !== undefined) {
        const zone = await zoneForPoint(input.lng, input.lat);
        if (!zone) {
          throw new ApiError(422, 'outside_service_area', 'no partner council covers this location');
        }
        zoneId = zone.id;
      } else {
        throw new ApiError(400, 'validation_failed', 'provide council_zone_id or lat+lng');
      }

      // One row per (email, zone): a repeat signup updates details and
      // re-activates. The response is identical either way — it must not
      // reveal whether the email was already registered.
      const { rows } = await query(
        `INSERT INTO volunteers (name, email, council_zone_id, help_types, note, consent_staff_only)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (lower(email), council_zone_id) DO UPDATE
           SET name = EXCLUDED.name, help_types = EXCLUDED.help_types,
               note = EXCLUDED.note, consent_staff_only = true, active = true
         RETURNING council_zone_id`,
        [input.name, input.email, zoneId, input.help_types, input.note ?? null],
      );
      const { rows: zone } = await query(
        `SELECT z.id, z.name, c.name AS council
         FROM council_zones z JOIN councils c ON c.id = z.council_id WHERE z.id = $1`,
        [rows[0].council_zone_id],
      );
      res.status(201).json({ ok: true, council_zone: zone[0] });
    } catch (e) {
      next(e);
    }
  },
);

// ----------------------------------------------------- GET /unsubscribe
// Public, token-based — linked from every volunteer email. Returns a small
// bilingual HTML page because the click lands in a browser.
const unsubPage = (en: string, mi: string) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${en}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#0f172a">
<h1 style="font-size:1.25rem">${en}</h1><p>${mi}</p></body></html>`;

router.get('/unsubscribe', async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    const { rowCount } = await query(
      'UPDATE volunteers SET active = false WHERE unsubscribe_token = $1::uuid AND active',
      [token],
    ).catch((e) => {
      // invalid uuid literal → cast error, not a 500
      if (String((e as { code?: string }).code) === '22P02') return { rowCount: 0 };
      throw e;
    });
    res.type('html').status(rowCount ? 200 : 404).send(
      rowCount
        ? unsubPage('You’re unsubscribed', 'Kua mutu tō whai muri — you will not get any more volunteer emails.')
        : unsubPage('Link not found', 'Kāore i kitea — this unsubscribe link is invalid or already used.'),
    );
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------------- GET /
// Staff-only volunteer directory — the duty officer connects a volunteer to
// a report. Council staff are scoped to their own council; platform_admin
// sees all and may filter by ?council_id= / ?council_zone_id=.
router.get('/', requireStaff, async (req, res, next) => {
  try {
    const where: string[] = [];
    const vals: unknown[] = [];
    const cond = (sql: string, v: unknown) => { vals.push(v); where.push(sql.replace('?', `$${vals.length}`)); };
    const intParam = (k: string): number | undefined => {
      if (req.query[k] === undefined) return undefined;
      const n = Number(req.query[k]);
      if (!Number.isInteger(n)) throw new ApiError(400, 'validation_failed', `${k} must be an integer`);
      return n;
    };
    if (req.user!.role !== 'platform_admin') {
      cond('c.id = ?', req.user!.council_id);
    } else {
      const councilId = intParam('council_id');
      const zoneId = intParam('council_zone_id');
      if (councilId !== undefined) cond('c.id = ?', councilId);
      if (zoneId !== undefined) cond('z.id = ?', zoneId);
    }
    const { rows } = await query(
      `SELECT v.id, v.name, v.email, v.help_types::text[] AS help_types, v.note, v.active, v.created_at,
              z.id AS zone_id, z.name AS zone_name, c.id AS council_id, c.name AS council_name
       FROM volunteers v
       JOIN council_zones z ON z.id = v.council_zone_id
       JOIN councils c ON c.id = z.council_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.name, z.name, v.created_at`,
      vals,
    );
    res.json({
      results: rows.map((v) => ({
        id: Number(v.id),
        name: v.name,
        email: v.email,
        help_types: v.help_types,
        note: v.note,
        active: v.active,
        council_zone: { id: v.zone_id, name: v.zone_name, council: v.council_name },
        created_at: v.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
