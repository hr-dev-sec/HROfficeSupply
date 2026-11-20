import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type AppLanguage = 'id' | 'en';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  tr: (idText: string, enText: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const LANG_KEY = 'hr_supplyhub_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'id' || saved === 'en') return saved;
    return 'id';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANG_KEY, language);
  }, [language]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'id' ? 'en' : 'id'));
  }, []);

  const tr = useCallback(
    (idText: string, enText: string) => (language === 'en' ? enText : idText),
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, tr }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage harus digunakan di dalam LanguageProvider');
  return ctx;
}
