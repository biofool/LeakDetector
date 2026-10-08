// frontend/src/App.tsx — routes: / report, /welcome onboarding, /actions wai actions,
// /settings, /map public, /r/:id tracking, /reports/:id read-only view, /staff.
import { Routes, Route, Navigate } from 'react-router-dom';
import ReportLeakPage from './pages/ReportLeakPage.js';
import PublicMapPage from './pages/PublicMapPage.js';
import ReportStatusPage from './pages/ReportStatusPage.js';
import PublicReportViewPage from './pages/PublicReportViewPage.js';
import DashboardPage from './pages/DashboardPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import ActionsPage from './pages/ActionsPage.js';
import SettingsPage from './pages/SettingsPage.js';
import { isOnboarded } from './i18n/LanguageContext.js';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Routes>
        <Route path="/" element={isOnboarded() ? <ReportLeakPage /> : <Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/map" element={<PublicMapPage />} />
        <Route path="/r/:id" element={<ReportStatusPage />} />
        <Route path="/reports/:id" element={<PublicReportViewPage />} />
        <Route path="/staff" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}
