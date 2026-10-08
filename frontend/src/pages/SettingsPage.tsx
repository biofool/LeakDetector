// frontend/src/pages/SettingsPage.tsx — language, location, notifications (/settings).
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.js';
import LanguageToggle from '../components/LanguageToggle.js';

export default function SettingsPage() {
  const { m } = useLang();
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{m.settings.title}</h1>
        <Link to="/" className="text-sm font-medium text-cyan-700 underline">{m.nav.report}</Link>
      </header>

      <section className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">{m.settings.language.label}</p>
          <div className="mt-2">
            <LanguageToggle />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">{m.settings.location.label}</p>
          <p className="mt-1 text-xs text-slate-500">{m.settings.location.helper}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">{m.settings.notifications.title}</p>
          <ul className="mt-2 space-y-2">
            {m.settings.notifications.options.map((o) => (
              <li key={o} className="text-sm text-slate-600">{o}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
