// frontend/src/pages/VolunteerPage.tsx — public volunteer signup (#37).
// No login; consent checkbox is mandatory (staff-only contact sharing).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCouncils, signupVolunteer } from '../api/reports.js';
import type { Council, HelpType } from '../api/reports.js';
import { useLang } from '../i18n/LanguageContext.js';
import LanguageToggle from '../components/LanguageToggle.js';

export default function VolunteerPage() {
  const { m } = useLang();
  const [councils, setCouncils] = useState<Council[] | null>(null);
  const [zonesErr, setZonesErr] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [help, setHelp] = useState<HelpType[]>([]);
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    listCouncils()
      .then((r) => setCouncils(r.results))
      .catch(() => setZonesErr(true));
  }, []);

  const toggleHelp = (t: HelpType) =>
    setHelp((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await signupVolunteer({
        name: name.trim(),
        email: email.trim(),
        council_zone_id: Number(zoneId),
        help_types: help,
        note: note.trim() || undefined,
        consent: true,
      });
      setDone(`${r.council_zone.name} — ${r.council_zone.council}`);
    } catch {
      setErr(m.volunteerPage.submitError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{m.volunteerPage.title}</h1>
          <p className="text-sm text-slate-500">{m.volunteerPage.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/" className="text-sm font-medium text-cyan-700 underline">{m.nav.report}</Link>
        </div>
      </header>

      {done ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-900">{m.volunteerPage.doneTitle}</h2>
          <p className="mt-1 text-sm text-emerald-800">{m.volunteerPage.doneBody(done)}</p>
        </section>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-600">{m.volunteerPage.body}</p>
          {zonesErr && (
            <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{m.volunteerPage.zonesFailed}</p>
          )}
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-medium text-slate-700">
              {m.volunteerPage.nameLabel}
              <input
                required maxLength={100} value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {m.volunteerPage.emailLabel}
              <input
                type="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {m.volunteerPage.zoneLabel}
              <select
                required value={zoneId} onChange={(e) => setZoneId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              >
                <option value="">{m.volunteerPage.zonePlaceholder}</option>
                {(councils ?? []).map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {c.zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <fieldset className="text-sm font-medium text-slate-700">
              <legend className="mb-1">{m.volunteerPage.helpLabel}</legend>
              {(['hands_on', 'routing'] as const).map((t) => (
                <label key={t} className="mt-1 flex items-center gap-2 font-normal">
                  <input type="checkbox" checked={help.includes(t)} onChange={() => toggleHelp(t)} />
                  {m.volunteerPage.helpTypes[t]}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm font-medium text-slate-700">
              {m.volunteerPage.noteLabel}
              <textarea
                maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={m.volunteerPage.notePlaceholder}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" rows={2}
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              {m.volunteerPage.consentLabel}
            </label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button
              disabled={busy || !consent || help.length === 0}
              className="w-full rounded-lg bg-cyan-700 px-4 py-2.5 font-medium text-white disabled:opacity-50"
            >
              {busy ? m.volunteerPage.sending : m.volunteerPage.submit}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
