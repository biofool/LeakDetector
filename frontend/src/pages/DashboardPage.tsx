// frontend/src/pages/DashboardPage.tsx — staff dashboard (/staff).
// Login → list sorted by sla_due_at, polled every 30 s; inline PATCH actions.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { login, session, listReports, patchReport, patchPhotoHidden, getReport, ApiError } from '../api/reports.js';
import type { Report, StaffSession, Status } from '../api/reports.js';
import { StatusBadge, SlaBadge } from '../components/StatusBadge.js';
import { timeAgo } from '../util/format.js';
import { useLang } from '../i18n/LanguageContext.js';

const NEXT: Record<Status, Status[]> = {
  received: ['investigating', 'contractor_assigned', 'resolved', 'closed_private'],
  investigating: ['contractor_assigned', 'resolved', 'closed_private'],
  contractor_assigned: ['investigating', 'resolved', 'closed_private'],
  resolved: ['investigating'],
  closed_private: ['investigating'],
};

export default function DashboardPage() {
  const { m } = useLang();
  const [sess, setSess] = useState<StaffSession | null>(() => session.get());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'open' | 'breached' | 'due_soon' | 'all'>('open');
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Report | null>(null);
  const [note, setNote] = useState('');
  const [dupTarget, setDupTarget] = useState('');
  const [actionErr, setActionErr] = useState('');

  const toggle = (id: number) => {
    setNote('');
    setDupTarget('');
    setDetail(null);
    setOpenId(openId === id ? null : id);
    if (openId !== id && sess) {
      getReport(id, sess.token).then(setDetail).catch(() => {});
    }
  };

  const refresh = useCallback(async () => {
    if (!sess) return;
    try {
      const params =
        filter === 'all' ? { sort: 'sla_due_at' as const, include_duplicates: true }
        : filter === 'open' ? { sort: 'sla_due_at' as const, status: 'received,investigating,contractor_assigned' }
        : { sort: 'sla_due_at' as const, sla: filter };
      const r = await listReports({ ...params, limit: 200 }, sess.token);
      setReports(r.results);
    } catch (e) {
      // Only an auth failure should sign staff out — transient errors keep the session.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        session.clear();
        setSess(null);
      } else {
        setActionErr(m.staff.refreshFailed);
      }
    }
  }, [sess, filter]);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!sess) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-900">{m.staff.signIn}</h1>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoginErr('');
            try {
              const s = await login(email, password);
              session.set(s);
              setSess(s);
            } catch (err) {
              setLoginErr(err instanceof Error ? err.message : m.staff.loginFailed);
            }
          }}
        >
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={m.staff.emailPlaceholder} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={m.staff.password} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
          {loginErr && <p className="text-sm text-red-600">{loginErr}</p>}
          <button className="w-full rounded-lg bg-cyan-700 px-4 py-2.5 font-medium text-white">{m.staff.signInButton}</button>
        </form>
      </main>
    );
  }

  const act = async (id: number, patch: Parameters<typeof patchReport>[1]) => {
    setActionErr('');
    try {
      const updated = await patchReport(id, patch, sess.token);
      setReports((rs) => rs.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : 'update failed');
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{m.staff.dashboard}</h1>
          <p className="text-xs text-slate-500">{sess.user.display_name} · {m.staff.refreshNote}</p>
        </div>
        <button onClick={() => { session.clear(); setSess(null); }} className="text-sm text-slate-500 underline">
          {m.staff.signOut}
        </button>
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        {(['open', 'due_soon', 'breached', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f ? 'border-cyan-700 bg-cyan-50 text-cyan-900' : 'border-slate-300 text-slate-600'
            }`}
          >
            {f === 'open' ? m.staff.filterOpen : f === 'due_soon' ? m.staff.filterDueSoon : f === 'breached' ? m.staff.filterBreached : m.staff.filterAll}
          </button>
        ))}
      </div>

      {actionErr && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionErr}</p>}

      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white">
            <button className="w-full p-3 text-left" onClick={() => toggle(r.id)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-medium text-cyan-800">{r.ref}</span>
                  <span className="text-xs text-slate-500">
                    {m.labels.location[r.location_type]} · {m.labels.severity[r.severity]}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <SlaBadge sla={r.sla_status} />
                  <StatusBadge status={r.status} />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>{timeAgo(r.created_at, m.time)}</span>
                {r.confirmation_count > 0 && <span>{m.staff.confirmations(r.confirmation_count)}</span>}
                {(r.nearby_open_count ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                    {m.staff.possibleDuplicate}
                  </span>
                )}
                {r.verified && <span className="text-emerald-700">{m.staff.verified}</span>}
              </div>
            </button>

            {openId === r.id && (
              <div className="space-y-3 border-t border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  {r.description && <p className="text-sm text-slate-700">{r.description}</p>}
                  <Link to={`/r/${r.id}`} className="shrink-0 text-xs text-cyan-700 underline">{m.staff.publicPage}</Link>
                </div>
                {detail?.reporter_contact && (
                  <p className="text-xs text-slate-500">
                    {m.staff.reporter} {detail.reporter_name ?? '—'} · {detail.reporter_contact}
                  </p>
                )}
                {(detail?.photos.length ?? 0) > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {detail!.photos.map((p) => (
                      <div key={p.id} className="shrink-0 text-center">
                        <img src={p.thumb_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        <button
                          onClick={() => sess && patchPhotoHidden(r.id, p.id, true, sess.token).then(refresh)}
                          className="mt-1 text-[10px] text-red-600 underline"
                        >
                          {m.staff.hide}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {NEXT[r.status].map((s) => (
                    <button
                      key={s}
                      onClick={() => act(r.id, { status: s })}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      → {m.labels.status[s]}
                    </button>
                  ))}
                  <button
                    onClick={() => act(r.id, { verified: !r.verified })}
                    className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  >
                    {r.verified ? m.staff.unverify : m.staff.verify}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={m.staff.notePlaceholder}
                    className="flex-1 rounded-lg border border-slate-300 p-2 text-xs"
                  />
                  <button
                    onClick={() => act(r.id, { public_note: note || null })}
                    className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium text-white"
                  >
                    {m.staff.post}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={dupTarget}
                    onChange={(e) => setDupTarget(e.target.value)}
                    placeholder={m.staff.dupPlaceholder}
                    inputMode="numeric"
                    className="flex-1 rounded-lg border border-slate-300 p-2 text-xs"
                  />
                  <button
                    onClick={() => act(r.id, { is_duplicate_of: dupTarget ? Number(dupTarget.replace(/\D/g, '')) : null })}
                    className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium text-white"
                  >
                    {m.staff.markDuplicate}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {reports.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">{m.staff.noReports}</li>}
      </ul>
    </main>
  );
}
