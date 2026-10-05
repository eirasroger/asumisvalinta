import type { Locale } from "@/i18n/config";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";

/** Tells search engines the site's name and logo; rendered on the front page. */
export function SiteJsonLd({ locale }: { locale: Locale }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Asumisvalinta",
        alternateName: "asumisvalinta.fi",
        url: `${SITE_URL}/`,
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Asumisvalinta",
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/apple-icon.png`,
        email: CONTACT_EMAIL,
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
