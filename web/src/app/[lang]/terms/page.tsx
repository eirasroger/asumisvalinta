import { pageMetadata } from "@/components/Shell";
import { TermsView } from "@/views/TermsView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "terms");
}

export default async function Page(props: LangParams) {
  return <TermsView locale={await localeOf(props)} />;
}
