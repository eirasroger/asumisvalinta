import { Home } from "@/components/home/Home";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { type LangParams, localeOf } from "./locale";

export default async function Page(props: LangParams) {
  return (
    <>
      <SiteJsonLd locale={await localeOf(props)} />
      <Home />
    </>
  );
}
