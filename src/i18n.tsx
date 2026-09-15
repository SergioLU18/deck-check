import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadLanguage, saveLanguage } from './lib/storage';
import { detectLanguage, STRINGS, type Language, type Strings } from './lib/strings';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Strings;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => detectLanguage(loadLanguage(), navigator.languages));

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      // Only an explicit choice is saved, so until then the browser's language wins.
      setLanguage: (next) => {
        setLanguage(next);
        saveLanguage(next);
      },
      t: STRINGS[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside a LanguageProvider.');
  return value;
}

/** The current language's strings. */
export const useT = () => useLanguage().t;
