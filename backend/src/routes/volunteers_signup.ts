// backend/src/routes/volunteers_signup.ts — POST / volunteer signup (#37).
// Signup only stages the row — report alerts start after the owner clicks
// the emailed verify link (#51). The response is identical whether the email
// is new or already registered, so it can't reveal registrations.
import { Router } from 'express';
import { z } from 'zod';
import { query, pool } from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { originCheck } from '../middleware/originCheck.js';
import { zoneForPoint } from '../services/zones.js';
import { queue } from '../services/outbox.js';
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
  originCheck,
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

      // One row per (email, zone): a repeat signup updates details but must
      // NOT re-activate an unsubscribed or unverified row — only clicking
      // the emailed verify link does that (#51). The response is identical
      // either way: it must not reveal whether the email was registered.
      const { rows } = await query(
        `INSERT INTO volunteers (name, email, council_zone_id, help_types, note, consent_staff_only)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (lower(email), council_zone_id) DO UPDATE
           SET name = EXCLUDED.name, help_types = EXCLUDED.help_types,
               note = EXCLUDED.note, consent_staff_only = true
         RETURNING id, council_zone_id, unsubscribe_token, verified`,
        [input.name, input.email, zoneId, input.help_types, input.note ?? null],
      );
      const v = rows[0];
      const { rows: zone } = await query(
        `SELECT z.id, z.name, c.name AS council
         FROM council_zones z JOIN councils c ON c.id = z.council_id WHERE z.id = $1`,
        [v.council_zone_id],
      );

      // Verify email (#51) — sent on every signup/re-signup; the dedupe key
      // caps it at one per volunteer per day. Unverified/unsubscribed rows
      // stay inactive until the owner clicks the link.
      await queue(pool, {
        channel: 'email',
        recipient: input.email,
        template: 'volunteer_verify',
        payload: {
          volunteer_name: input.name,
          zone: zone[0].name,
          verify_url: `${config.apiPublicUrl}/api/v1/volunteers/verify?token=${v.unsubscribe_token}`,
          unsubscribe_url: `${config.apiPublicUrl}/api/v1/volunteers/unsubscribe?token=${v.unsubscribe_token}`,
        },
        dedupe_key: `volunteer_verify:${v.id}:${new Date().toISOString().slice(0, 10)}`,
      });
      res.status(201).json({ ok: true, council_zone: zone[0] });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
