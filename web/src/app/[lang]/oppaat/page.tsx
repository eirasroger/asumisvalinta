import { guidesMetadata } from "@/components/Shell";
import { loadGuides } from "@/lib/guides";
import { GuidesIndexView } from "@/views/GuideView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return guidesMetadata(await localeOf(props));
}

export default async function Page(props: LangParams) {
  const locale = await localeOf(props);
  return <GuidesIndexView locale={locale} guides={await loadGuides(locale)} />;
}
