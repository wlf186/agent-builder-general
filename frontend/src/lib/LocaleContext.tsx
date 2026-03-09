"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, t, TranslationKey, getLocaleName } from "./i18n";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  getLocaleName: (locale: Locale) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  // 从 localStorage 恢复语言设置
  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale;
    if (saved && (saved === "zh" || saved === "en")) {
      setLocale(saved);
    }
  }, []);

  // 保存语言设置到 localStorage
  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale: handleSetLocale,
        t: (key: TranslationKey) => t(locale, key),
        getLocaleName,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
