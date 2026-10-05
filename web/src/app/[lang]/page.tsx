import { Home } from "@/components/home/Home";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { guideCards } from "@/lib/guides";
import { type LangParams, localeOf } from "./locale";

export default async function Page(props: LangParams) {
  const locale = await localeOf(props);
  return (
    <>
      <SiteJsonLd locale={locale} />
      <Home guides={await guideCards(locale)} />
    </>
  );
}
