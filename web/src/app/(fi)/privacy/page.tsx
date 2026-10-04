import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { PrivacyView } from "@/views/PrivacyView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "privacy");

export default function Page() {
  return <PrivacyView locale={DEFAULT_LOCALE} />;
}
