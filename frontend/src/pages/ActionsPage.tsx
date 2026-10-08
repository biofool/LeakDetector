// frontend/src/pages/ActionsPage.tsx — the three Wai Action modules (/actions).
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.js';
import LanguageToggle from '../components/LanguageToggle.js';

export default function ActionsPage() {
  const { m } = useLang();
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{m.actions.title}</h1>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/" className="text-sm font-medium text-cyan-700 underline">{m.nav.report}</Link>
        </div>
      </header>
      <p className="mb-6 text-sm text-slate-600">{m.actions.intro}</p>

      <div className="space-y-8">
        {m.actions.modules.map((mod) => (
          <section key={mod.title}>
            <h2 className="text-lg font-semibold text-slate-900">{mod.title}</h2>
            <p className="text-sm font-medium text-cyan-700">{mod.subtitle}</p>
            <p className="mt-1 text-sm text-slate-600">{mod.body}</p>
            <ul className="mt-3 space-y-2">
              {mod.cards.map((c) => (
                <li key={c.lead} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <strong className="text-slate-800">{c.lead}</strong>
                  <span className="text-slate-500"> — {c.rest}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
