// frontend/src/pages/PublicMapPage.tsx — public map of recent reports (/map).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LeafletMap from '../components/LeafletMap.js';
import LanguageToggle from '../components/LanguageToggle.js';
import { listReports } from '../api/reports.js';
import type { Report, Status } from '../api/reports.js';
import { timeAgo } from '../util/format.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useLang } from '../i18n/LanguageContext.js';

const COLOUR: Record<Status, string> = {
  received: '#0284c7',
  investigating: '#d97706',
  contractor_assigned: '#7c3aed',
  resolved: '#059669',
  closed_private: '#64748b',
};

export default function PublicMapPage() {
  const { m } = useLang();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<Status | ''>('');
  const nav = useNavigate();

  useEffect(() => {
    listReports({ status: status || undefined, limit: 200 })
      .then((r) => setReports(r.results))
      .catch(() => setReports([]));
  }, [status]);

  const markers = useMemo(
    () => reports.map((r) => ({ lat: r.lat, lng: r.lng, colour: COLOUR[r.status], label: `${r.ref} — ${m.labels.status[r.status]}` })),
    [reports, m],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{m.mapPage.title}</h1>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/" className="text-sm font-medium text-cyan-700 underline">{m.nav.report}</Link>
        </div>
      </header>
      <div className="mb-3 flex flex-wrap gap-2">
        {(['', 'received', 'investigating', 'contractor_assigned', 'resolved'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === s ? 'border-cyan-700 bg-cyan-50 text-cyan-900' : 'border-slate-300 text-slate-600'
            }`}
          >
            {s ? m.labels.status[s] : m.mapPage.all}
          </button>
        ))}
      </div>
      <LeafletMap centre={[-41.28, 174.77]} zoom={12} markers={markers} onMarkerClick={(i) => nav(`/reports/${reports[i].id}`)} />
      <ul className="mt-4 space-y-2">
        {reports.slice(0, 20).map((r) => (
          <li key={r.id}>
            <Link to={`/reports/${r.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <span className="text-sm font-medium text-slate-900">{r.ref}</span>
                <span className="ml-2 text-xs text-slate-500">{timeAgo(r.created_at, m.time)}</span>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-xs text-slate-400">{m.mapPage.dropOff}</p>
    </main>
  );
}
