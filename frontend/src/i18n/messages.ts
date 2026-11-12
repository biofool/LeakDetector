// frontend/src/i18n/messages.ts — bilingual copy (Te reo Māori / English).
// Source: operator-supplied Wai Action onboarding & microcopy. Keep the `en`
// and `mi` trees structurally identical — both must satisfy Messages.
// The copy lives in messages.en.json / messages.mi.json (stored data files
// over hardcoding); leaves shaped `{ "tpl": "…{arg}…" }` are hydrated here
// into the formatting functions this module has always exported. `{s}` is
// the English plural marker — it renders "s" unless the first argument is 1.
import enJson from './messages.en.json';
import miJson from './messages.mi.json';

export type Lang = 'en' | 'mi';

/** `{ tpl: "…" }` leaves become formatter functions; everything else is data. */
type DeepFns<T> = T extends { tpl: string }
  ? (...args: (string | number)[]) => string
  : T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly DeepFns<U>[]
      : { [K in keyof T]: DeepFns<T[K]> };

function template(s: string): (...args: (string | number)[]) => string {
  const params = [
    ...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((p) => p !== 's')),
  ];
  return (...args) =>
    s.replace(/\{(\w+)\}/g, (_raw, name: string) =>
      name === 's' ? (Number(args[0]) === 1 ? '' : 's') : String(args[params.indexOf(name)]),
    );
}

function hydrate<T>(node: T): DeepFns<T> {
  if (typeof node === 'string') return node as DeepFns<T>;
  if (Array.isArray(node)) return node.map(hydrate) as unknown as DeepFns<T>;
  const rec = node as Record<string, unknown>;
  if ('tpl' in rec) return template(rec.tpl as string) as DeepFns<T>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = hydrate(v);
  return out as DeepFns<T>;
}

export type Messages = DeepFns<typeof enJson>;

export const messages: Record<Lang, Messages> = {
  en: hydrate(enJson),
  mi: hydrate(miJson),
};
