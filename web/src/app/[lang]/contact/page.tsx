import { pageMetadata } from "@/components/Shell";
import { ContactView } from "@/views/ContactView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "contact");
}

export default async function Page(props: LangParams) {
  return <ContactView locale={await localeOf(props)} />;
}