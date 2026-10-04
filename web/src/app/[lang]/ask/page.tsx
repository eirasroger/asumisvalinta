import { Ask } from "@/components/ask/Ask";
import { pageMetadata } from "@/components/Shell";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "ask");
}

export default function Page() {
  return <Ask />;
}
