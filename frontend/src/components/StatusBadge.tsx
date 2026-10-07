// frontend/src/components/StatusBadge.tsx — status + SLA chips.
import type { Status, SlaStatus } from '../api/reports.js';
import { STATUS_LABELS, SLA_LABELS, SLA_COLOURS } from '../util/format.js';

const STATUS_COLOURS: Record<Status, string> = {
  received: 'bg-sky-100 text-sky-800',
  investigating: 'bg-amber-100 text-amber-800',
  contractor_assigned: 'bg-violet-100 text-violet-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed_private: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOURS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SlaBadge({ sla }: { sla: SlaStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${SLA_COLOURS[sla]}`}>
      {SLA_LABELS[sla]}
    </span>
  );
}
