import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LogoMark } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { PageAnalytics } from "@/components/PageAnalytics";
import { DEFAULT_LOCALE, LOCALES, type Locale, localePath } from "@/i18n/config";
import { I18nProvider } from "@/i18n/I18nProvider";
import { MESSAGES, type Messages } from "@/i18n/messages";
import { OG_SIZE, ogAlt } from "@/lib/ogImage";
import { SITE_URL } from "@/lib/site";
import "@/app/globals.css";

const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });

function alternates(locale: Locale, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((language) => [language, localePath(language, path)])),
      "x-default": localePath(DEFAULT_LOCALE, path),
    },
  };
}

export function siteMetadata(locale: Locale): Metadata {
  const description = MESSAGES[locale].meta.description;
  const image = { url: localePath(locale, "/og.png"), ...OG_SIZE, alt: ogAlt(locale), type: "image/png" };
  return {
    metadataBase: new URL(SITE_URL),
    title: "Asumisvalinta",
    description,
    alternates: alternates(locale, "/"),
    openGraph: { title: "Asumisvalinta", description, siteName: "Asumisvalinta", type: "website", locale, images: [image] },
    twitter: { card: "summary_large_image", title: "Asumisvalinta", description, images: [image] },
  };
}

/** Metadata of a page: its title in the language of the page. */
export function pageMetadata(locale: Locale, page: keyof Omit<Messages["meta"], "description">): Metadata {
  return { title: `${MESSAGES[locale].meta[page]} · Asumisvalinta`, alternates: alternates(locale, `/${page}`) };
}

export function Shell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html lang={locale} className={schibsted.variable}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale}>
          <header className="sticky top-0 z-40 border-b border-line bg-paper">
            <div className="flex h-14 items-center gap-6 px-4 max-[380px]:gap-4 sm:gap-8 sm:px-6">
              <Link href={localePath(locale, "/")} className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
                <LogoMark size={24} className="-ml-0.5" />
                <span className="max-sm:sr-only">Asumisvalinta</span>
              </Link>
              <Nav />
              <LanguageSwitch />
            </div>
          </header>
          {children}
          <PageAnalytics />
          <Footer dataDocs={existsSync(path.join(process.cwd(), "public", "data-docs", "index.html"))} />
        </I18nProvider>
      </body>
    </html>
  );
}
