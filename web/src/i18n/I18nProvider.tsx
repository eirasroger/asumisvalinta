"use client";

import { createContext, useContext, useMemo } from "react";
import { type Locale, localePath } from "@/i18n/config";
import { MESSAGES, type Messages } from "@/i18n/messages";

interface I18n {
  locale: Locale;
  t: Messages;
  /** A path in the current language, for a path written without a language prefix. */
  href: (path: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: MESSAGES[locale], href: (path: string) => localePath(locale, path) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n needs an I18nProvider");
  return value;
}
