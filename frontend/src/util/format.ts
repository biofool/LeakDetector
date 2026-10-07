// frontend/src/util/format.ts — labels + display helpers (NZ English).
import type { Location, Severity, Status, SlaStatus } from '../api/reports.js';

export const LOCATION_LABELS: Record<Location, string> = {
  footpath: 'Footpath',
  berm: 'Berm / verge',
  road: 'Road',
  water_meter: 'Water meter / toby',
  outside_tap: 'Outside tap',
  other_public: 'Other public place',
};

export const STATUS_LABELS: Record<Status, string> = {
  received: 'Received',
  investigating: 'Investigating',
  contractor_assigned: 'Contractor assigned',
  resolved: 'Fixed',
  closed_private: 'Private property',
};

export const SLA_LABELS: Record<SlaStatus, string> = {
  on_track: 'On track',
  due_soon: 'Due soon',
  breached: 'Overdue',
  met: 'Fixed in time',
  missed: 'Fixed late',
  'n/a': '—',
};

export const SLA_COLOURS: Record<SlaStatus, string> = {
  on_track: 'bg-emerald-100 text-emerald-800',
  due_soon: 'bg-amber-100 text-amber-800',
  breached: 'bg-red-100 text-red-800',
  met: 'bg-emerald-100 text-emerald-800',
  missed: 'bg-amber-100 text-amber-800',
  'n/a': 'bg-slate-100 text-slate-500',
};

export const SEVERITY_HELP: Record<Severity, string> = {
  major: 'Gushing or spraying; flowing across road or footpath; flooding property; a hole or sinking in the road; loss of pressure.',
  minor: 'A steady trickle; damp or boggy berm; pooling water; a dripping meter or tap.',
};

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
