import { pageMetadata } from "@/components/Shell";
import { AboutView } from "@/views/AboutView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "about");
}

export default async function Page(props: LangParams) {
  return <AboutView locale={await localeOf(props)} />;
}
