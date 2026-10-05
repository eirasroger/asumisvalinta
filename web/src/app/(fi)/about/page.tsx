import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { AboutView } from "@/views/AboutView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "about");

export default function Page() {
  return <AboutView locale={DEFAULT_LOCALE} />;
}
