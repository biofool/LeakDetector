// backend/src/routes/volunteers_directory.ts — GET / staff-only volunteer
// directory (#37). The duty officer connects a volunteer to a report.
// Privacy: volunteer contact details are staff-only — no public response
// returns names/emails.
import { Router } from 'express';
import { query } from '../db.js';
import { ApiError } from '../middleware/errors.js';
import { requireStaff } from '../middleware/staffAuth.js';

const router = Router();

// ------------------------------------------------------------------- GET /
// Council staff are scoped to their own council; platform_admin sees all and
// may filter by ?council_id= / ?council_zone_id=.
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
      `SELECT v.id, v.name, v.email, v.help_types::text[] AS help_types, v.note, v.active, v.verified, v.created_at,
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
        verified: v.verified,
        council_zone: { id: v.zone_id, name: v.zone_name, council: v.council_name },
        created_at: v.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
