// backend/src/routes/reports_create.ts — spec §3: POST / (report intake,
// photo upload, outbox fan-out). Mounted by reports.ts.
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { withTx } from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { originCheck } from '../middleware/originCheck.js';
import { computeSLA } from '../services/sla.js';
import { zoneForPoint } from '../services/zones.js';
import { findNearby } from '../services/duplicates.js';
import { processPhoto, removeKeys } from '../services/photos.js';
import type { ProcessedPhoto } from '../services/photos.js';
import { queue } from '../services/outbox.js';
import { alertTargets } from '../services/submission.js';
import { toRef } from '../util/ref.js';
import { LOCATIONS, SEVERITIES } from '../types.js';
import type { ReportRow } from '../types.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3 },
});

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
  originCheck,
  upload.array('photos', 3),
  async (req, res, next) => {
    // #54 — photos are re-encoded and stored BEFORE the DB transaction so
    // the pool connection is never held through sharp + file I/O. Any
    // objects stored for a report that fails to insert are removed again
    // (best-effort — removeKeys logs failures).
    const storedKeys: string[] = [];
    try {
      const input = createSchema.parse(req.body);
      const files = (req.files as Express.Multer.File[]) ?? [];
      for (const f of files) {
        if (!IMAGE_TYPES.has(f.mimetype)) {
          throw new ApiError(415, 'unsupported_type', `photo type ${f.mimetype} not supported`);
        }
      }
      const photos: ProcessedPhoto[] = [];
      for (const f of files) {
        let p: ProcessedPhoto;
        try {
          p = await processPhoto(f.buffer);
        } catch {
          throw new ApiError(415, 'unsupported_type', 'photo could not be processed — is it a real image?');
        }
        storedKeys.push(p.storage_key, p.thumb_key);
        photos.push(p);
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

        for (const p of photos) {
          await client.query(
            `INSERT INTO report_photos (report_id, storage_key, thumb_key, content_type, width, height, bytes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, p.storage_key, p.thumb_key, p.content_type, p.width, p.height, p.bytes],
          );
        }

        // Reporter is CC'd on the authority alert when the contact is an
        // email address (#24). payload.cc → Postmark Cc in the worker.
        const cc = contact?.includes('@') ? contact : undefined;
        const payload = {
          ref, category: input.category, severity: input.severity, tracking_url,
          zone: zone.name, sla_due_at, cc, lat: input.lat, lng: input.lng,
        };
        // The council's submission_channel picks the intake adapter (#35);
        // unimplemented channels and empty targets fall back to email.
        const targets = alertTargets(
          zone.submission_channel, zone.channel_config,
          zone.alert_emails, config.alertFallbackEmail,
        );
        for (const t of targets) {
          await queue(client, {
            report_id: id, channel: t.channel, recipient: t.recipient,
            template: t.channel === 'sms' ? 'authority_sms' : 'new_report',
            payload, dedupe_key: `new_report:${id}:${t.channel}:${t.recipient}`,
          });
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
        // Volunteers registered in this zone get one heads-up email per
        // report (#37) — capped at 20, dedupe_keyed per report+volunteer.
        const { rows: volunteers } = await client.query(
          `SELECT id, name, email, unsubscribe_token FROM volunteers
           WHERE council_zone_id = $1 AND active AND verified ORDER BY id LIMIT 20`,
          [zone.id],
        );
        for (const v of volunteers) {
          await queue(client, {
            report_id: id,
            channel: 'email',
            recipient: v.email,
            template: 'volunteer_new_report',
            // Field by field, not `...payload`: that carries `cc` (the
            // reporter's email), which the worker would send as Cc (#44).
            payload: {
              ref, category: input.category, severity: input.severity,
              tracking_url, zone: zone.name,
              volunteer_name: v.name,
              unsubscribe_url: `${config.apiPublicUrl}/api/v1/volunteers/unsubscribe?token=${v.unsubscribe_token}`,
            },
            dedupe_key: `volunteer_new_report:${id}:${v.id}`,
          });
        }
        // story_graph export (#43): built field by field, not spread from
        // `payload`, so reporter contact (cc) and coordinates never leave.
        if (config.storyGraphIngestEmail) {
          await queue(client, {
            report_id: id,
            channel: 'email',
            recipient: config.storyGraphIngestEmail,
            template: 'story_graph_export',
            payload: {
              ref, tracking_url, category: input.category, severity: input.severity,
              zone: zone.name, created_at: r.created_at,
              api_url: `${config.apiPublicUrl}/api/v1/reports/${id}`,
            },
            dedupe_key: `story_graph:${id}`,
          });
        }
        // Ops copy: every report goes to the leakreports@ inbox so a human
        // can forward it to the correct authority. The routing note is built
        // from the same `targets` the real alert used, so it can't drift.
        if (config.leakReportsEmail) {
          await queue(client, {
            report_id: id,
            channel: 'email',
            recipient: config.leakReportsEmail,
            template: 'leak_report_copy',
            payload: {
              ref, tracking_url, category: input.category, severity: input.severity,
              description: input.description, council: zone.council_name,
              zone: zone.name, lat: input.lat, lng: input.lng, created_at: r.created_at,
              authority_note: targets.length
                ? targets.map((t) => (t.channel === 'sms' ? `SMS to ${t.recipient}` : t.recipient)).join(', ')
                : 'no council intake address on file — check the council website',
            },
            dedupe_key: `leak_report_copy:${id}`,
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
            sms_number: zone.submission_channel === 'sms'
              ? (zone.channel_config?.sms_number ?? null) : null,
          },
        },
        sla_due_at,
        tracking_url: report.tracking_url,
        possible_duplicates: duplicates.map((d) => ({ id: d.id, distance_m: d.distance_m, status: d.status })),
      });
    } catch (e) {
      await removeKeys(storedKeys); // report insert failed — don't orphan the files
      next(e);
    }
  },
);

export default router;
