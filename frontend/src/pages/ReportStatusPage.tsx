// frontend/src/pages/ReportStatusPage.tsx — public tracking page (/r/:id).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LeafletMap from '../components/LeafletMap.js';
import { StatusBadge, SlaBadge } from '../components/StatusBadge.js';
import { getReport, confirmReport } from '../api/reports.js';
import type { Report } from '../api/reports.js';
import { timeAgo } from '../util/format.js';
import { useLang } from '../i18n/LanguageContext.js';

export default function ReportStatusPage() {
  const { m } = useLang();
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmErr, setConfirmErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getReport(id).then(setReport).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <main className="mx-auto max-w-xl p-6"><p className="text-red-600">{err}</p></main>;
  if (!report) return <main className="mx-auto max-w-xl p-6"><p className="text-slate-500">{m.common.loading}</p></main>;

  const open = ['received', 'investigating', 'contractor_assigned'].includes(report.status);

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Link to="/map" className="text-sm text-cyan-700 underline">{m.common.backToMap}</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{report.ref}</h1>
        <StatusBadge status={report.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {m.labels.location[report.location_type]} · {m.labels.severity[report.severity]} · {m.common.reported} {timeAgo(report.created_at, m.time)}
      </p>

      <div className="mt-4">
        <LeafletMap centre={[report.lat, report.lng]} markers={[{ lat: report.lat, lng: report.lng }]} />
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {report.description && <p className="text-sm text-slate-700">{report.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          <SlaBadge sla={report.sla_status} />
          {report.verified && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">{m.common.verifiedByCouncil}</span>}
          {report.confirmation_count > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
              {m.common.seenByOthers(report.confirmation_count)}
            </span>
          )}
        </div>
        {report.public_note && (
          <p className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900">
            {m.common.councilUpdate} {report.public_note}
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
          {report.council_zone.council} — {report.council_zone.name} · {m.common.slaDue}{' '}
          {new Date(report.sla_due_at).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}
        </p>
      </div>

      {open && !confirmed && (
        <button
          onClick={() => confirmReport(report.id).then(() => setConfirmed(true)).catch(() => setConfirmErr(m.statusPage.confirmError))}
          className="mt-4 w-full rounded-xl border border-cyan-700 bg-white px-4 py-3 font-medium text-cyan-800"
        >
          {m.statusPage.iveSeenToo}
        </button>
      )}
      {confirmErr && <p className="mt-2 text-center text-sm text-red-600">{confirmErr}</p>}
      {confirmed && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-sm text-emerald-800">{m.statusPage.thanks}</p>}
      {report.status === 'resolved' && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-800">
          {m.labels.status[report.status]} {report.resolved_at ? `— ${timeAgo(report.resolved_at, m.time)}` : ''}
        </p>
      )}
    </main>
  );
}
