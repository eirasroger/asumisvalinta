import { pageMetadata } from "@/components/Shell";
import { CompareView } from "@/views/CompareView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "compare");
}

export default function Page() {
  return <CompareView />;
}
