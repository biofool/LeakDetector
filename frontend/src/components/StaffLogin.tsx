// frontend/src/components/StaffLogin.tsx — staff sign-in form, extracted
// from DashboardPage (issue #68). Owns its input state; calls back with the
// session once login + session.set have succeeded.
import { useState } from 'react';
import { login, session } from '../api/reports.js';
import type { StaffSession } from '../api/reports.js';
import { useLang } from '../i18n/LanguageContext.js';

export function StaffLogin({ onLogin }: { onLogin: (s: StaffSession) => void }) {
  const { m } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');

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
            onLogin(s);
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
