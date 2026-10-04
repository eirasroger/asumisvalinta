import { pageMetadata } from "@/components/Shell";
import { MethodologyView } from "@/views/MethodologyView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "methodology");
}

export default async function Page(props: LangParams) {
  return <MethodologyView locale={await localeOf(props)} />;
}
