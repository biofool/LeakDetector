// frontend/src/pages/ReportLeakPage.tsx — public reporting flow (/).
import LeakReportForm from '../components/LeakReportForm.js';
import { Link } from 'react-router-dom';

export default function ReportLeakPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report a water leak</h1>
          <p className="text-sm text-slate-500">Spotted a leak on public land? Tell the council in 30 seconds.</p>
        </div>
        <Link to="/map" className="text-sm font-medium text-cyan-700 underline">Map</Link>
      </header>
      <LeakReportForm />
      <p className="mt-6 text-center text-xs text-slate-400">
        Leak on your own property? That’s the owner’s job — call a plumber.
      </p>
    </main>
  );
}
