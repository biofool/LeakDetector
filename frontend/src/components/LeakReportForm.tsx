// frontend/src/components/LeakReportForm.tsx — locate → duplicate check →
// details → submit (spec §5 reporter flow).
import { useEffect, useState } from 'react';
import LeafletMap from './LeafletMap.js';
import NearbySheet from './NearbySheet.js';
import { createReport, nearby } from '../api/reports.js';
import type { CreatedReport, Location, NearbyResult, Severity } from '../api/reports.js';
import { useLang } from '../i18n/LanguageContext.js';

type Step = 'locate' | 'duplicates' | 'details' | 'done' | 'confirmed';

const LOCATIONS: Location[] = ['footpath', 'berm', 'road', 'water_meter', 'outside_tap', 'other_public'];
const NZ_CENTRE: [number, number] = [-41.28, 174.77]; // Wellington

export default function LeakReportForm() {
  const { m } = useLang();
  const [step, setStep] = useState<Step>('locate');
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [checking, setChecking] = useState(false);
  const [dups, setDups] = useState<NearbyResult[]>([]);
  const [confirmedId, setConfirmedId] = useState<number | null>(null);

  const [category, setCategory] = useState<Location | null>(null);
  const [severity, setSeverity] = useState<Severity>('minor');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [created, setCreated] = useState<CreatedReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setPin([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const checkNearby = async () => {
    if (!pin) return;
    setChecking(true);
    try {
      const { results } = await nearby(pin[0], pin[1], 30, accuracy);
      if (results.length) {
        setDups(results);
        setStep('duplicates');
      } else {
        setStep('details');
      }
    } catch {
      setStep('details'); // a failed check shouldn't block reporting
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (!pin || !category) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    form.set('lat', String(pin[0]));
    form.set('lng', String(pin[1]));
    if (accuracy !== undefined) form.set('accuracy_m', String(accuracy));
    form.set('category', category);
    form.set('severity', severity);
    form.set('description', description);
    if (name.trim()) form.set('reporter_name', name.trim());
    if (contact.trim()) form.set('reporter_contact', contact.trim());
    photos.forEach((p) => form.append('photos', p));
    try {
      setCreated(await createReport(form));
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : m.form.submitError);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'confirmed') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="font-semibold text-emerald-900">{m.form.alreadyKnown}</p>
        <a href={`/r/${confirmedId}`} className="mt-2 inline-block text-sm font-medium text-cyan-800 underline">
          {m.form.trackThatReport}
        </a>
      </div>
    );
  }

  if (step === 'done' && created) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-lg font-semibold text-emerald-900">{m.form.sent} — {created.ref}</p>
        <p className="mt-1 text-sm text-emerald-800">
          {m.form.routedTo(created.council_zone.council, created.council_zone.name)}
        </p>
        <a href={created.tracking_url} className="mt-3 inline-block rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white">
          {m.form.trackYours}
        </a>
        {created.possible_duplicates.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {m.form.similarNearby(created.possible_duplicates.length)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1 — locate */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">{m.form.step1Title}</h2>
        <p className="mt-1 text-sm text-slate-500">{m.form.step1Help}</p>
        <div className="mt-3">
          <LeafletMap
            centre={pin ?? NZ_CENTRE}
            pin={pin}
            onPinMove={(lat, lng) => { setPin([lat, lng]); setAccuracy(undefined); }}
            onPick={(lat, lng) => { setPin([lat, lng]); setAccuracy(undefined); }}
          />
        </div>
        <button
          type="button"
          disabled={!pin || checking}
          onClick={checkNearby}
          className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2.5 font-medium text-white disabled:opacity-40"
        >
          {checking ? m.form.checking : pin ? m.form.confirmSpot : m.form.dropPin}
        </button>
      </section>

      {/* Step 2 — duplicate check */}
      {step === 'duplicates' && (
        <NearbySheet
          results={dups}
          onDifferent={() => setStep('details')}
          onConfirmed={(id) => { setConfirmedId(id); setStep('confirmed'); }}
        />
      )}

      {/* Step 3 — details */}
      {step === 'details' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">{m.form.step2Title}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setCategory(loc)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    category === loc ? 'border-cyan-700 bg-cyan-50 text-cyan-900' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {m.labels.location[loc]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">{m.form.step3Title}</h2>
            {(['major', 'minor'] as Severity[]).map((s) => (
              <label key={s} className="mt-2 flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3">
                <input
                  type="radio"
                  name="severity"
                  checked={severity === s}
                  onChange={() => setSeverity(s)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{m.labels.severity[s]}</span>
                  <span className="block text-xs text-slate-500">{m.labels.severityHelp[s]}</span>
                </span>
              </label>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">{m.form.step4Title}</h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={m.form.descPlaceholder}
              className="mt-2 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
            />
            <label className="mt-2 block text-sm font-medium text-slate-700">
              {m.form.photosLabel}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="mt-1 block w-full text-sm"
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 3))}
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={m.form.namePlaceholder}
                maxLength={100}
                className="rounded-lg border border-slate-300 p-2.5 text-sm"
              />
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={m.form.contactPlaceholder}
                maxLength={200}
                className="rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>
          </section>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button
            type="button"
            disabled={!category || busy}
            onClick={submit}
            className="w-full rounded-xl bg-cyan-700 px-4 py-3 text-lg font-semibold text-white disabled:opacity-40"
          >
            {busy ? m.form.sending : m.form.send}
          </button>
        </>
      )}
    </div>
  );
}
