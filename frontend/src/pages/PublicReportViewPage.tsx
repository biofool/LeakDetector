// frontend/src/pages/PublicReportViewPage.tsx — read-only report view (/reports/:id).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LeafletMap from '../components/LeafletMap.js';
import { StatusBadge, SlaBadge } from '../components/StatusBadge.js';
import { ApiError, getReport } from '../api/reports.js';
import type { Report, Status } from '../api/reports.js';
import { LOCATION_LABELS, STATUS_LABELS, timeAgo } from '../util/format.js';

const FLOW: Status[] = ['received', 'investigating', 'contractor_assigned', 'resolved'];

interface Step {
  status: Status;
  at: string | null;
  state: 'done' | 'current' | 'next';
}

function timeline(report: Report): Step[] {
  const steps: Status[] =
    report.status === 'closed_private' ? ['received', 'closed_private'] : FLOW;
  const current = steps.indexOf(report.status);
  return steps.map((status, i) => ({
    status,
    at:
      status === 'received'
        ? report.created_at
        : status === 'resolved'
          ? report.resolved_at
          : null,
    state: i < current ? 'done' : i === current ? 'current' : 'next',
  }));
}

const DOT: Record<Step['state'], string> = {
  done: 'bg-cyan-700',
  current: 'bg-cyan-700 ring-4 ring-cyan-100',
  next: 'bg-slate-300',
};

export default function PublicReportViewPage() {
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getReport(id)
      .then(setReport)
      .catch((e) =>
        setErr(e instanceof ApiError && e.status === 404 ? 'not_found' : e.message),
      );
  }, [id]);

  if (err === 'not_found')
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Report not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This report does not exist or may have been removed.
        </p>
        <Link to="/map" className="mt-4 inline-block text-sm text-cyan-700 underline">
          ← View the map
        </Link>
      </main>
    );
  if (err) return <main className="mx-auto max-w-xl p-6"><p className="text-red-600">{err}</p></main>;
  if (!report) return <main className="mx-auto max-w-xl p-6"><p className="text-slate-500">Loading…</p></main>;

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Link to="/map" className="text-sm text-cyan-700 underline">← Map</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{report.ref}</h1>
        <StatusBadge status={report.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {LOCATION_LABELS[report.location_type]} · {report.severity} · reported {timeAgo(report.created_at)}
      </p>

      <div className="mt-4">
        <LeafletMap centre={[report.lat, report.lng]} markers={[{ lat: report.lat, lng: report.lng }]} />
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Status</h2>
        <ol className="mt-3 space-y-3">
          {timeline(report).map((step) => (
            <li key={step.status} className="flex items-center gap-3">
              <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[step.state]}`} />
              <span
                className={
                  step.state === 'next'
                    ? 'text-sm text-slate-400'
                    : 'text-sm font-medium text-slate-800'
                }
              >
                {STATUS_LABELS[step.status]}
                {step.at && <span className="font-normal text-slate-500"> — {timeAgo(step.at)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {report.description && <p className="text-sm text-slate-700">{report.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          <SlaBadge sla={report.sla_status} />
          {report.verified && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">Verified by council</span>}
          {report.confirmation_count > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
              Seen by {report.confirmation_count} other{report.confirmation_count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {report.public_note && (
          <p className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900">
            Council update: {report.public_note}
          </p>
        )}
        {report.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {report.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <img src={p.thumb_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">
          {report.council_zone.council} — {report.council_zone.name} · SLA due{' '}
          {new Date(report.sla_due_at).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}
        </p>
      </section>
    </main>
  );
}
