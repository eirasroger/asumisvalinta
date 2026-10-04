import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { ExploreView } from "@/views/ExploreView";

export const metadata = pageMetadata(DEFAULT_LOCALE, "explore");

export default function Page() {
  return <ExploreView />;
}
