// frontend/src/App.tsx — routes: / report, /map public, /r/:id tracking, /staff.
import { Routes, Route } from 'react-router-dom';
import ReportLeakPage from './pages/ReportLeakPage.js';
import PublicMapPage from './pages/PublicMapPage.js';
import ReportStatusPage from './pages/ReportStatusPage.js';
import DashboardPage from './pages/DashboardPage.js';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Routes>
        <Route path="/" element={<ReportLeakPage />} />
        <Route path="/map" element={<PublicMapPage />} />
        <Route path="/r/:id" element={<ReportStatusPage />} />
        <Route path="/staff" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}
