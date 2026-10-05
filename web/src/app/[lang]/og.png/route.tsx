import { ogImage } from "@/lib/ogImage";
import { generateLangParams, type LangParams, localeOf } from "../locale";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = generateLangParams;

export async function GET(_request: Request, props: LangParams) {
  return ogImage(await localeOf(props));
}
