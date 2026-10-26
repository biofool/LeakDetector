// frontend/src/i18n/LanguageContext.tsx — app-wide language toggle (en/mi), persisted.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { messages, type Lang, type Messages } from './messages.js';

const KEY = 'leakdetector.lang';

interface LangCtx {
  lang: Lang;
  m: Messages;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({ lang: 'en', m: messages.en, setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    localStorage.getItem(KEY) === 'mi' ? 'mi' : 'en',
  );
  const setLang = (l: Lang) => {
    localStorage.setItem(KEY, l);
    setLangState(l);
  };
  return <Ctx.Provider value={{ lang, m: messages[lang], setLang }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

// No onboarded flag — reporting is the unconditional home (c3b6b11); the
// flag was written but never read and re-gating / could strand users (#57).
