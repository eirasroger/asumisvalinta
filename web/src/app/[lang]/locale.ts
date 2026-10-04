import { notFound } from "next/navigation";
import { isLocale, type Locale, PREFIXED_LOCALES } from "@/i18n/config";

export interface LangParams {
  params: Promise<{ lang: string }>;
}

/** Every language served under a prefix gets its own copy of each page at build time. */
export const generateLangParams = () => PREFIXED_LOCALES.map((lang) => ({ lang }));

export async function localeOf({ params }: LangParams): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang) || !PREFIXED_LOCALES.includes(lang)) notFound();
  return lang;
}
