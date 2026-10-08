// frontend/src/components/LanguageToggle.tsx — Te reo Māori / English switch.
import { useLang } from '../i18n/LanguageContext.js';

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  const base = 'rounded-md px-2 py-1 text-xs font-medium';
  const on = `${base} bg-cyan-700 text-white`;
  const off = `${base} text-cyan-700`;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-white p-0.5" role="group" aria-label="Language / Reo">
      <button type="button" className={lang === 'mi' ? on : off} onClick={() => setLang('mi')}>Māori</button>
      <button type="button" className={lang === 'en' ? on : off} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}
