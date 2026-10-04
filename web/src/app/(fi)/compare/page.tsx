import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { CompareView } from "@/views/CompareView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "compare");

export default function Page() {
  return <CompareView />;
}
