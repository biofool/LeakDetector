// backend/src/routes/reports_staff.ts — spec §3: staff-only mutations
// (PATCH /:id/photos/:photoId, PATCH /:id). Mounted by reports.ts.
import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db.js';
import { ApiError } from '../middleware/errors.js';
import { requireStaff, canAccess } from '../middleware/staffAuth.js';
import { computeSLA } from '../services/sla.js';
import { removeKeys, copyToFreshKey } from '../services/photos.js';
import { queue } from '../services/outbox.js';
import { toReport } from '../util/serialize.js';
import { toRef } from '../util/ref.js';
import { LOCATIONS, SEVERITIES, STATUSES } from '../types.js';
import type { Location, Severity, Status, ReportRow } from '../types.js';
import { REPORT_SELECT, NEARBY_OPEN_COL, photosOf } from './reports_shared.js';

const router = Router();

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
    const { rows: photos } = await query(
      'SELECT id, storage_key, thumb_key, is_hidden FROM report_photos WHERE id = $1 AND report_id = $2',
      [req.params.photoId, req.params.id],
    );
    const photo = photos[0];
    if (!photo) throw new ApiError(404, 'not_found', 'photo not found on this report');

    // #52 — hiding must kill the public URL, not just filter it out of API
    // responses: the old key may already sit in browser history, emails, or
    // caches. Move both objects to fresh keys; only staff see the new ones.
    let storageKey = photo.storage_key;
    let thumbKey = photo.thumb_key;
    // Copy both objects to fresh keys, point the row at them, then delete the
    // old objects last — a mid-sequence failure must not leave the row
    // pointing at moved files (#57). Fresh copies are removed on failure so
    // they don't orphan either.
    const copied: string[] = [];
    if (body.is_hidden && !photo.is_hidden) {
      try {
        storageKey = await copyToFreshKey(photo.storage_key);
        if (storageKey !== photo.storage_key) copied.push(storageKey);
        thumbKey = await copyToFreshKey(photo.thumb_key);
        if (thumbKey !== photo.thumb_key) copied.push(thumbKey);
      } catch (e) {
        await removeKeys(copied);
        throw e;
      }
    }
    try {
      await query(
        'UPDATE report_photos SET is_hidden = $1, storage_key = $2, thumb_key = $3 WHERE id = $4',
        [body.is_hidden, storageKey, thumbKey, photo.id],
      );
    } catch (e) {
      await removeKeys(copied);
      throw e;
    }
    const stale = [photo.storage_key, photo.thumb_key].filter((k) => k !== storageKey && k !== thumbKey);
    if (stale.length) await removeKeys(stale);
    res.json({ id: Number(photo.id), is_hidden: body.is_hidden });
  } catch (e) {
    next(e);
  }
});

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
          // Lock both rows in id order before validating — concurrent PATCHes
          // A→B / B→A would otherwise both pass under READ COMMITTED and
          // create a 2-cycle that vanishes both reports from lists (#57).
          await client.query(
            'SELECT id FROM reports WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
            [[Number(row.id), patch.is_duplicate_of].sort((a, b) => a - b)],
          );
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

export default router;
