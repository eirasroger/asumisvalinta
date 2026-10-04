import { Shell, siteMetadata } from "@/components/Shell";
import { generateLangParams, type LangParams, localeOf } from "./locale";

export const dynamicParams = false;
export const generateStaticParams = generateLangParams;

export async function generateMetadata(props: LangParams) {
  return siteMetadata(await localeOf(props));
}

export default async function PrefixedLocaleLayout(props: LangParams & { children: React.ReactNode }) {
  return <Shell locale={await localeOf(props)}>{props.children}</Shell>;
}
