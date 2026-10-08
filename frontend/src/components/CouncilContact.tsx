// frontend/src/components/CouncilContact.tsx — direct-to-council contact card
// (#34). Renders nothing when the council has no registered channels.
import { useLang } from '../i18n/LanguageContext.js';
import type { Report } from '../api/reports.js';

export default function CouncilContact({ report }: { report: Report }) {
  const { m } = useLang();
  const c = report.council_zone.contact;
  if (!c || (!c.entity && !c.phone && !c.form_url && !c.app)) return null;
  const tel = c.phone?.split('/')[0].replace(/[^\d+]/g, '');
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{m.statusPage.contactHeading}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {m.statusPage.servicedBy(c.entity ?? report.council_zone.council)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {c.phone && tel && (
          <a
            href={`tel:${tel}`}
            className="rounded-xl border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800"
          >
            {m.statusPage.callNow} {c.phone}
          </a>
        )}
        {c.form_url && (
          <a
            href={c.form_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            {m.statusPage.reportOnline}
          </a>
        )}
      </div>
      {c.app && <p className="mt-2 text-xs text-slate-500">{m.statusPage.appNote(c.app)}</p>}
    </section>
  );
}
