import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { MethodologyView } from "@/views/MethodologyView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "methodology");

export default function Page() {
  return <MethodologyView locale={DEFAULT_LOCALE} />;
}
