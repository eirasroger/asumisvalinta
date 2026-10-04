import { pageMetadata } from "@/components/Shell";
import { PrivacyView } from "@/views/PrivacyView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "privacy");
}

export default async function Page(props: LangParams) {
  return <PrivacyView locale={await localeOf(props)} />;
}
