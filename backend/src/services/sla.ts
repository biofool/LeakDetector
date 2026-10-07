// backend/src/services/sla.ts — spec §4, verbatim logic.
// Resolution targets are placeholder defaults [D-08]; replace per council.
import type { Location, Severity, ReportRow } from '../types.js';

const HOUR = 3_600_000;

export const SLA_HOURS: Record<Severity, Record<Location, number>> = {
  major: { road: 12, water_meter: 12, footpath: 24, berm: 24, other_public: 24, outside_tap: 48 },
  minor: { road: 48, water_meter: 72, footpath: 72, berm: 72, other_public: 120, outside_tap: 120 },
};

export function computeSLA(severity: Severity, locationType: Location, createdAt: Date): Date {
  const hours = SLA_HOURS[severity]?.[locationType];
  if (hours === undefined) {
    throw new Error(`No SLA rule for severity=${severity} location_type=${locationType}`);
  }
  return new Date(createdAt.getTime() + hours * HOUR);
}

// on_track | due_soon | breached | met | missed | n/a
export function slaStatus(r: Pick<ReportRow, 'is_duplicate_of' | 'status' | 'resolved_at' | 'sla_due_at' | 'created_at'>, now = new Date()): string {
  if (r.is_duplicate_of || r.status === 'closed_private') return 'n/a';
  const slaDue = new Date(r.sla_due_at).getTime();
  const created = new Date(r.created_at).getTime();
  if (r.status === 'resolved') {
    return new Date(r.resolved_at!).getTime() <= slaDue ? 'met' : 'missed';
  }
  const left = slaDue - now.getTime();
  if (left < 0) return 'breached';
  const window = Math.min(2 * HOUR, 0.25 * (slaDue - created));
  return left <= window ? 'due_soon' : 'on_track';
}
