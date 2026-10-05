import { Home } from "@/components/home/Home";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { guideCards } from "@/lib/guides";

export default async function Page() {
  return (
    <>
      <SiteJsonLd locale={DEFAULT_LOCALE} />
      <Home guides={await guideCards(DEFAULT_LOCALE)} />
    </>
  );
}
