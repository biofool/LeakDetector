// frontend/src/pages/OnboardingPage.tsx — first-run 3-screen onboarding (/welcome).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { markOnboarded, useLang } from '../i18n/LanguageContext.js';
import LanguageToggle from '../components/LanguageToggle.js';

export default function OnboardingPage() {
  const { m } = useLang();
  const nav = useNavigate();
  const [step, setStep] = useState(0);

  const finish = () => {
    markOnboarded();
    nav('/');
  };

  const screens = [
    <section key="welcome" className="text-center">
      <h1 className="text-2xl font-bold text-slate-900">{m.onboarding.welcome.title}</h1>
      <p className="mt-1 text-sm font-medium text-cyan-700">{m.onboarding.welcome.subtitle}</p>
      <p className="mt-4 text-sm text-slate-600">{m.onboarding.welcome.body}</p>
    </section>,
    <section key="why" className="text-center">
      <h1 className="text-2xl font-bold text-slate-900">{m.onboarding.why.title}</h1>
      <p className="mt-4 text-sm text-slate-600">{m.onboarding.why.body}</p>
    </section>,
    <section key="principles">
      <h1 className="text-center text-2xl font-bold text-slate-900">{m.onboarding.principles.title}</h1>
      <ul className="mt-4 space-y-3">
        {m.onboarding.principles.bullets.map((b) => (
          <li key={b.lead} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            <strong className="text-slate-800">{b.lead}</strong> {b.rest}
          </li>
        ))}
      </ul>
    </section>,
  ];

  const last = step === screens.length - 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {screens.map((_, i) => (
            <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-cyan-700' : 'bg-slate-200'}`} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          {!last && (
            <button type="button" onClick={finish} className="text-xs text-slate-400 underline">
              {m.onboarding.skip}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center">{screens[step]}</div>

      <button
        type="button"
        onClick={() => (last ? finish() : setStep(step + 1))}
        className="mt-6 w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white"
      >
        {last ? m.onboarding.done : step === 0 ? m.onboarding.welcome.button : m.onboarding.why.button}
      </button>
    </main>
  );
}
