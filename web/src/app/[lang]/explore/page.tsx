import { pageMetadata } from "@/components/Shell";
import { ExploreView } from "@/views/ExploreView";
import { type LangParams, localeOf } from "../locale";

export async function generateMetadata(props: LangParams) {
  return pageMetadata(await localeOf(props), "explore");
}

export default function Page() {
  return <ExploreView />;
}
