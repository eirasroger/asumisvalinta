/**
 * Languages of the site. The default language lives at the root (/compare); every other
 * language has a prefix (/en/compare). Adding a language means adding it here and writing
 * its messages file; the routes come from this list.
 */
export const LOCALES = ["fi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fi";

/** Each language named in itself, as Finnish sites label their language links. */
export const LOCALE_LINKS: Record<Locale, string> = {
  fi: "Suomeksi",
  en: "In English",
};

/** Languages served under a prefix. */
export const PREFIXED_LOCALES: Locale[] = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** The path of a page in a language, for a path written without a language prefix. */
export function localePath(locale: Locale, path: string) {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** The language of a pathname and the pathname without its language prefix. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && isLocale(first) && first !== DEFAULT_LOCALE) return { locale: first, path: `/${rest.join("/")}` };
  return { locale: DEFAULT_LOCALE, path: pathname };
}
