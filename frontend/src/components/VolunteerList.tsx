// frontend/src/components/VolunteerList.tsx — staff volunteer directory
// section, extracted from DashboardPage (issue #68).
import type { Volunteer } from '../api/reports.js';
import { useLang } from '../i18n/LanguageContext.js';

export function VolunteerList({ volunteers }: { volunteers: Volunteer[] }) {
  const { m } = useLang();
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{m.staff.volunteersTitle}</h2>
      {volunteers.length === 0 ? (
        <p className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">{m.staff.volunteersNone}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {volunteers.map((v) => (
            <li key={v.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{v.name}</span>
                <span className="text-xs text-slate-500">
                  {v.help_types.map((t) => m.volunteerPage.helpTypes[t].split(' — ')[0]).join(' · ')}
                  {!v.active && ` · ${m.staff.volunteerInactive}`}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                <a href={`mailto:${v.email}`} className="text-cyan-700 underline">{v.email}</a>
                {' · '}{v.council_zone.name} ({v.council_zone.council})
              </p>
              {v.note && <p className="mt-1 text-xs text-slate-600">{v.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
