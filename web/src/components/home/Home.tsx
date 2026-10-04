"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AnimatedLogoMark } from "@/components/Logo";
import { type Section, SectionPreview } from "@/components/SectionPreview";
import { useI18n } from "@/i18n/I18nProvider";

const SECTIONS: { section: Section; path: string }[] = [
  { section: "explore", path: "/explore" },
  { section: "compare", path: "/compare" },
  { section: "ask", path: "/ask" },
];

const Arrow = ({ className = "" }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className={className}>
    <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Home() {
  const { t, href } = useI18n();
  const router = useRouter();

  // Links to an area used to open the map at the root; send them on to the map.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("postal")) {
      router.replace(`${href("/explore")}${window.location.search}`);
    }
  }, [router, href]);

  return (
    <div className="relative overflow-hidden">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 aspect-[2000/588] h-full -translate-x-1/2 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        >
          <div className="map-reveal h-full [mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
            <div className="h-full bg-[url(/home/finland.svg)] bg-contain bg-center bg-no-repeat" />
          </div>
        </div>
        <section className="relative mx-auto flex min-h-[68dvh] max-w-3xl flex-col items-center justify-center px-6 pt-16 pb-10 text-center">
          <AnimatedLogoMark size={76} className="text-ink" />
          <h1 className="fade-up mt-6 text-[44px] leading-none font-semibold tracking-[-0.035em] sm:text-[64px]" style={{ animationDelay: "150ms" }}>
            Asumisvalinta
          </h1>
          <p className="fade-up mt-5 max-w-xl text-[17px] leading-relaxed text-balance text-ink [text-shadow:0_0_6px_var(--frost),0_0_14px_var(--frost)] sm:text-lg" style={{ animationDelay: "280ms" }}>
            {t.home.tagline}
          </p>
          <div className="fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "420ms" }}>
            <Link
              href={href("/explore")}
              className="group flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-medium text-paper shadow-float transition-transform hover:-translate-y-0.5"
            >
              {t.home.cta}
              <Arrow className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={href("/compare")}
              className="flex h-12 items-center rounded-xl border border-line bg-paper px-6 text-[15px] font-medium transition-colors hover:border-line-strong"
            >
              {t.home.secondary}
            </Link>
          </div>
        </section>
      </div>

      <section className="relative mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-3">
        {SECTIONS.map(({ section, path }, index) => (
          <Link
            key={section}
            href={href(path)}
            className="fade-up group rounded-2xl border border-line bg-paper p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-line-strong hover:shadow-float"
            style={{ animationDelay: `${560 + index * 100}ms` }}
          >
            <div className="h-36 rounded-xl bg-frost p-3">
              <SectionPreview section={section} />
            </div>
            <h2 className="mt-4 flex items-center justify-between text-[15px] font-semibold">
              {t.nav[section]}
              <Arrow className="text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-ink" />
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-ink-3">{t.preview[section]}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
