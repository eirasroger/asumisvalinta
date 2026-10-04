import { isLocale, PREFIXED_LOCALES } from "@/i18n/config";
import { OG_SIZE, ogAlt, ogImage } from "@/lib/ogImage";
import { localeOf } from "./locale";

type Params = { lang?: string } | Promise<{ lang?: string }> | undefined;

/** Next also calls this while collecting routes, before the language is known. */
export async function generateImageMetadata({ params }: { params: Params }) {
  const lang = (await params)?.lang;
  const locale = lang && isLocale(lang) ? lang : PREFIXED_LOCALES[0];
  return [{ id: "home", alt: ogAlt(locale), size: OG_SIZE, contentType: "image/png" }];
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  return ogImage(await localeOf({ params }));
}
