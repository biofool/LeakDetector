// backend/src/util/serialize.ts — DB row → spec report object (§3).
// Public view strips reporter_name/reporter_contact/gps_accuracy_m [D-12]
// and staff-hidden photos.
import { toRef } from './ref.js';
import { slaStatus } from '../services/sla.js';
import { photoUrl } from '../services/photos.js';
import type { ReportRow, PhotoRow } from '../types.js';

export function toReport(row: ReportRow & { lat: number; lng: number }, photos: PhotoRow[], staff: boolean, history: { from_status: string | null; to_status: string; changed_at: string }[] = []) {
  const visible = staff ? photos : photos.filter((p) => !p.is_hidden);
  const report: Record<string, unknown> = {
    id: Number(row.id),
    ref: toRef(row.id),
    category: row.category,
    location_type: row.location_type,
    severity: row.severity,
    status: row.status,
    description: row.description,
    public_note: row.public_note,
    lat: row.lat,
    lng: row.lng,
    council_zone: {
      id: row.council_zone_id,
      name: row.zone_name,
      council: row.council_name,
      contact: {
        entity: row.entity ?? null,
        phone: row.contact_phone ?? null,
        form_url: row.contact_form_url ?? null,
        app: row.contact_app ?? null,
      },
    },
    verified: row.verified,
    is_duplicate_of: row.is_duplicate_of == null ? null : Number(row.is_duplicate_of),
    confirmation_count: row.confirmation_count,
    sla_due_at: row.sla_due_at,
    sla_status: slaStatus(row),
    photos: visible.map((p) => ({ id: Number(p.id), url: photoUrl(p.storage_key), thumb_url: photoUrl(p.thumb_key) })),
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Public audit trail: status names + timestamps only (no staff identity).
    status_history: history.map((h) => ({ from_status: h.from_status, to_status: h.to_status, at: h.changed_at })),
  };
  if (staff) {
    report.reporter_name = row.reporter_name;
    report.reporter_contact = row.reporter_contact;
    report.gps_accuracy_m = row.gps_accuracy_m;
    if (row.nearby_open_count !== undefined) report.nearby_open_count = Number(row.nearby_open_count);
  }
  return report;
}
