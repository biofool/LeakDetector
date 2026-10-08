// frontend/src/util/format.ts — display helpers. User-facing labels now live in
// src/i18n/messages.ts (bilingual) — read them via useLang().m.labels.
import type { SlaStatus } from '../api/reports.js';
import type { Messages } from '../i18n/messages.js';

export const SLA_COLOURS: Record<SlaStatus, string> = {
  on_track: 'bg-emerald-100 text-emerald-800',
  due_soon: 'bg-amber-100 text-amber-800',
  breached: 'bg-red-100 text-red-800',
  met: 'bg-emerald-100 text-emerald-800',
  missed: 'bg-amber-100 text-amber-800',
  'n/a': 'bg-slate-100 text-slate-500',
};

export function timeAgo(iso: string, t: Messages['time'], now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return t.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return t.minutesAgo(m);
  const h = Math.round(m / 60);
  if (h < 24) return t.hoursAgo(h);
  return t.daysAgo(Math.round(h / 24));
}
