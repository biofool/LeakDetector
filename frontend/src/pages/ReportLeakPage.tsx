// frontend/src/pages/ReportLeakPage.tsx — public reporting flow (/).
import LeakReportForm from '../components/LeakReportForm.js';
import LanguageToggle from '../components/LanguageToggle.js';
import { useLang } from '../i18n/LanguageContext.js';
import { Link } from 'react-router-dom';

export default function ReportLeakPage() {
  const { m } = useLang();
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{m.reportPage.title}</h1>
          <p className="text-sm text-slate-500">{m.reportPage.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/actions" className="text-sm font-medium text-cyan-700 underline">{m.nav.actions}</Link>
          <Link to="/volunteer" className="text-sm font-medium text-cyan-700 underline">{m.nav.volunteer}</Link>
          <Link to="/map" className="text-sm font-medium text-cyan-700 underline">{m.nav.map}</Link>
        </div>
      </header>
      <LeakReportForm />
      <Link
        to="/actions"
        className="mt-4 block rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm"
      >
        <span className="font-semibold text-cyan-900">{m.reportPage.actionsTitle}</span>
        <span className="mt-0.5 block text-cyan-800">{m.reportPage.actionsBody}</span>
        <span className="mt-1 inline-block font-medium text-cyan-700 underline">
          {m.reportPage.actionsLink} →
        </span>
      </Link>
      <p className="mt-6 text-center text-xs text-slate-400">
        {m.reportPage.privateNote}{' '}
        <Link to="/welcome" className="underline">
          {m.reportPage.introLink}
        </Link>
      </p>
    </main>
  );
}
