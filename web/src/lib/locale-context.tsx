"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { Locale } from "./i18n";

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "en",
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "en" || saved === "zh") {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  // 防止 hydration 不匹配，未挂载时返回默认（en）
  return (
    <LocaleContext.Provider value={{ locale: mounted ? locale : "en", setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
