// frontend/src/components/NearbySheet.tsx — pre-submit duplicate check
// (spec §5 reporter UX).
import type { NearbyResult } from '../api/reports.js';
import { confirmReport } from '../api/reports.js';
import { timeAgo } from '../util/format.js';
import { StatusBadge } from './StatusBadge.js';
import { useLang } from '../i18n/LanguageContext.js';

interface Props {
  results: NearbyResult[];
  onDifferent: () => void;
  onConfirmed: (id: number) => void;
}

export default function NearbySheet({ results, onDifferent, onConfirmed }: Props) {
  const { m } = useLang();
  const confirm = async (id: number) => {
    try {
      await confirmReport(id);
      onConfirmed(id);
    } catch {
      // already resolved etc. — let them continue to their own report
      onDifferent();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{m.form.dupTitle}</h2>
      <p className="mt-1 text-sm text-slate-500">{m.form.dupHelp}</p>
      <ul className="mt-3 space-y-3">
        {results.map((r) => (
          <li key={r.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
            {r.thumb_url && (
              <img src={r.thumb_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">{m.labels.location[r.category]}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {r.ref} · {timeAgo(r.created_at, m.time)} · {Math.round(r.distance_m)} {m.form.metresAway}
                {r.confirmation_count > 0 && ` · ${m.form.seenBy(r.confirmation_count)}`}
              </p>
              {r.status === 'resolved' ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-amber-700">
                    {m.form.fixedAgain}
                  </p>
                  <button
                    type="button"
                    onClick={onDifferent}
                    className="mt-1 rounded-lg border border-amber-600 px-3 py-1.5 text-sm font-medium text-amber-800"
                  >
                    {m.form.leakingAgain}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => confirm(r.id)}
                  className="mt-2 rounded-lg bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {m.form.yesThatsIt}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDifferent}
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
      >
        {m.form.different}
      </button>
    </div>
  );
}
