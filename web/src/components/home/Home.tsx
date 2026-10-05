"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Arrow } from "@/components/icons";
import { AnimatedLogoMark } from "@/components/Logo";
import { Reveal } from "@/components/about/Reveal";
import { AskThread, HelsinkiMap, NIGHT, WealthChart } from "@/components/showcase";
import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages";

const ROWS: { key: "map" | "compare" | "ask"; path: string; cta: (t: Messages) => string }[] = [
  { key: "map", path: "/explore", cta: (t) => t.home.cta },
  { key: "compare", path: "/compare", cta: (t) => t.home.secondary },
  { key: "ask", path: "/ask", cta: (t) => t.home.askCta },
];

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

      <section className="relative mx-auto max-w-6xl space-y-24 px-6 pt-12 pb-28 sm:space-y-32 sm:pt-20 sm:pb-36">
        {ROWS.map(({ key, path, cta }, index) => (
          <div key={key} className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal className={index % 2 ? "lg:order-2" : ""}>
              <h2 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:text-[36px]">
                {t.home[`${key}Title`]}
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{t.home[`${key}Body`]}</p>
              <Link href={href(path)} className="group mt-7 inline-flex items-center gap-2 text-[15px] font-medium">
                <span className="underline decoration-line-strong underline-offset-4 transition-colors group-hover:decoration-ink">
                  {cta(t)}
                </span>
                <Arrow className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal delay={120} className={index % 2 ? "lg:order-1" : ""}>
              {key === "map" && <HelsinkiMap />}
              {key === "compare" && <WealthChart t={t} />}
              {key === "ask" && <AskThread t={t} />}
            </Reveal>
          </div>
        ))}
      </section>

      <section className={`relative overflow-hidden ${NIGHT} text-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
        <img
          src="/about/finland-dots.svg"
          alt=""
          className="pointer-events-none absolute top-[-20%] right-[-4%] w-[300px] opacity-60 [mask-image:linear-gradient(to_left,black_45%,transparent)] sm:right-[6%] sm:w-[420px]"
        />
        <Reveal className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <h2 className="max-w-xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[48px]">{t.home.bandTitle}</h2>
          <p className="mt-4 max-w-md text-lg text-white/70">{t.home.bandBody}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={href("/explore")}
              className="group flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              {t.home.cta}
              <Arrow className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={href("/compare")}
              className="flex h-12 items-center rounded-xl px-6 text-[15px] font-medium text-white ring-1 ring-white/30 transition-colors hover:bg-white/10"
            >
              {t.home.secondary}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
