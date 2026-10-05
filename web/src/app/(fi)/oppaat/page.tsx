import { guidesMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { loadGuides } from "@/lib/guides";
import { GuidesIndexView } from "@/views/GuideView";

export const metadata = guidesMetadata(DEFAULT_LOCALE);

export default async function Page() {
  return <GuidesIndexView locale={DEFAULT_LOCALE} guides={await loadGuides(DEFAULT_LOCALE)} />;
}
