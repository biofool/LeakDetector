// backend/src/routes/councils.ts — public council/zone directory (#37).
// Id + name only — contact channels stay on report payloads, alert emails
// are never exposed here.
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id AS council_id, c.name AS council_name, z.id AS zone_id, z.name AS zone_name
       FROM councils c JOIN council_zones z ON z.council_id = c.id
       ORDER BY c.name, z.name`,
    );
    const councils = new Map<number, { id: number; name: string; zones: { id: number; name: string }[] }>();
    for (const r of rows) {
      let c = councils.get(r.council_id);
      if (!c) councils.set(r.council_id, (c = { id: r.council_id, name: r.council_name, zones: [] }));
      c.zones.push({ id: r.zone_id, name: r.zone_name });
    }
    res.json({ results: [...councils.values()] });
  } catch (e) {
    next(e);
  }
});

export default router;
