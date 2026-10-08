import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { TermsView } from "@/views/TermsView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "terms");

export default function Page() {
  return <TermsView locale={DEFAULT_LOCALE} />;
}
