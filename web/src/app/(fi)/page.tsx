import { Home } from "@/components/home/Home";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { DEFAULT_LOCALE } from "@/i18n/config";

export default function Page() {
  return (
    <>
      <SiteJsonLd locale={DEFAULT_LOCALE} />
      <Home />
    </>
  );
}
