import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { ContactView } from "@/views/ContactView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "contact");

export default function Page() {
  return <ContactView locale={DEFAULT_LOCALE} />;
}