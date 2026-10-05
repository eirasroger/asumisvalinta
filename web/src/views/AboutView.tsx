import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Reveal } from "@/components/about/Reveal";
import { Arrow } from "@/components/icons";
import { LogoMark } from "@/components/Logo";
import { HelsinkiMap, MIST, NIGHT, OPTION_DOT, OPTIONS, WealthChart } from "@/components/showcase";
import { type Locale, localePath } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { CONTACT_EMAIL } from "@/lib/site";

/** Dot map colours, low to high price (scripts/build-about-maps.mjs). */
const DOT_SCALE = ["#243a52", "#28507c", "#2c66a6", "#3580d6", "#5a9be6", "#86b6ef", "#b4d2f7"];
const HORIZON_YEARS = 30;
const SOURCE_COUNT = 4;

async function mapFacts() {
  const file = (name: string) => readFile(path.join(process.cwd(), "public", "map", name), "utf-8");
  try {
    const values: unknown[] = JSON.parse(await file("values-two_room.json"));
    const trends: { years: number[] } = JSON.parse(await file("trends-two_room.json"));
    return { areas: values.length, historyYears: trends.years.length };
  } catch {
    return null;
  }
}

const Heading = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[44px] ${className}`}>{children}</h2>
);

function Glass({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`absolute rounded-2xl bg-white/[0.07] px-4 py-3 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

const ICONS = [
  <path key="independent" d="M12 3 5 6v5c0 4.4 3 8.4 7 9.5 4-1.1 7-5.1 7-9.5V6l-7-3Z" />,
  <path key="open" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  <path key="careful" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 3 3 5-6" />,
  <path key="estimates" d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
];

export async function AboutView({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale];
  const a = t.about;
  const href = (page: string) => localePath(locale, page);
  const facts = await mapFacts();
  const count = new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-IE");
  const dataDocs = existsSync(path.join(process.cwd(), "public", "data-docs", "index.html"));
  const stats = [
    ...(facts
      ? [
          { value: count.format(facts.areas), label: a.stats.areas },
          { value: String(facts.historyYears), label: a.stats.history },
        ]
      : []),
    { value: String(HORIZON_YEARS), label: a.stats.horizon },
    { value: String(SOURCE_COUNT), label: a.stats.sources },
  ];

  return (
    <div className="overflow-x-clip bg-paper">
      <section className={`relative overflow-hidden ${NIGHT} text-white`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-[-10%] size-[720px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(57,135,229,0.22),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pt-16 pb-12 sm:px-6 lg:pb-0 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-0">
          <div className="lg:py-28">
            <h1 className="fade-up text-[40px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-[64px]">
              {a.heroTitle}
            </h1>
            <p className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-white/70" style={{ animationDelay: "120ms" }}>
              {a.heroLead}
            </p>
            <div className="fade-up mt-9 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
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
          </div>

          <div className="relative mx-auto aspect-[648/1139] w-full max-w-[300px] sm:max-w-[360px] lg:my-12 lg:max-w-[370px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
            <img src="/about/finland-dots.svg" alt="" className="map-reveal absolute inset-0 size-full" />
            <Glass className="float top-[30%] -left-4 sm:-left-16">
              <p className="text-[11px] tracking-wide text-white/60">{a.mapLegend}</p>
              <span
                className="mt-2 block h-1.5 w-40 rounded-full"
                style={{ background: `linear-gradient(90deg, ${DOT_SCALE.join(", ")})` }}
              />
              <p className="mt-1.5 flex justify-between text-[11px] text-white/60">
                <span>{a.legendLow}</span>
                <span>{a.legendHigh}</span>
              </p>
            </Glass>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-28 sm:px-6 sm:pt-36">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Heading>{a.statementTitle}</Heading>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{a.statementBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {OPTIONS.map((option) => (
              <Link
                key={option}
                href={href("/compare")}
                className="flex h-11 items-center gap-2.5 rounded-full border border-line-strong px-5 text-sm font-medium transition-colors hover:border-ink"
              >
                <span className={`size-2.5 rounded-full ${OPTION_DOT[option]}`} />
                {t.options.label[option]}
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-16 sm:mt-20">
          <div className="grid overflow-hidden rounded-[32px] border border-line bg-paper shadow-float lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <h3 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[30px]">{a.costTitle}</h3>
              <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{a.costBody}</p>
              <Link
                href={href("/compare")}
                className="group mt-8 flex h-12 w-fit items-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5"
              >
                {t.home.secondary}
                <Arrow className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className={`relative ${MIST} p-6 sm:p-10 lg:rounded-l-[140px] lg:pl-20`}>
              <span aria-hidden="true" className="dots absolute top-6 right-6 h-24 w-36 text-buy/30" />
              <div className="relative">
                <WealthChart t={t} />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-28 sm:px-6 sm:pt-40">
        <Reveal>
          <Heading className="text-center">{a.differentTitle}</Heading>
        </Reveal>

        <div className="mt-16 grid items-center gap-12 sm:mt-20 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <h3 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[30px]">{a.dataTitle}</h3>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{a.dataBody}</p>
          </Reveal>
          <Reveal delay={120}>
            <HelsinkiMap />
          </Reveal>
        </div>

        <div className="mt-24 grid items-center gap-12 sm:mt-32 lg:grid-cols-2 lg:gap-20">
          <Reveal className="lg:order-2">
            <h3 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[30px]">{a.engineTitle}</h3>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{a.engineBody}</p>
          </Reveal>
          <Reveal delay={120} className="lg:order-1">
            <div className="relative mx-auto aspect-square w-full max-w-[460px]">
              <span aria-hidden="true" className="dots absolute -right-4 -bottom-6 h-32 w-40 text-aso/40" />
              <div
                className={`absolute inset-0 overflow-hidden rounded-[56%_44%_52%_48%/48%_56%_44%_52%] ${NIGHT} text-white`}
              >
                {[1, 0.74, 0.5].map((scale) => (
                  <span
                    key={scale}
                    aria-hidden="true"
                    className="absolute top-1/2 left-1/2 aspect-square -translate-1/2 rounded-full border border-white/10"
                    style={{ width: `${scale * 82}%` }}
                  />
                ))}
                <span className="absolute top-1/2 left-1/2 flex size-28 -translate-1/2 items-center justify-center rounded-[28px] bg-white/[0.06] ring-1 ring-white/15">
                  <LogoMark size={64} />
                </span>
              </div>
              {a.engineChips.map((chip, index) => (
                <span
                  key={chip}
                  className={`float absolute flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-[13px] font-medium shadow-float ring-1 ring-line ${
                    ["top-[12%] -left-2", "top-[46%] -right-3 [animation-delay:-2s]", "bottom-[12%] left-[8%] [animation-delay:-3.4s]"][index]
                  }`}
                >
                  <span className={`size-2 rounded-full ${OPTION_DOT[OPTIONS[index]]}`} />
                  {chip}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className={`relative mt-28 overflow-hidden ${MIST} sm:mt-40`}>
        <span aria-hidden="true" className="absolute -top-40 -left-40 size-[420px] rounded-[45%_55%_60%_40%] bg-[#d6e7fb]" />
        <span aria-hidden="true" className="absolute -right-32 -bottom-48 size-[460px] rounded-[58%_42%_40%_60%] bg-[#cfe2fa]" />
        <span aria-hidden="true" className="dots absolute bottom-8 left-[8%] h-28 w-48 text-ink/25" />
        <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute top-6 right-[6%] w-56 text-ink/30" fill="none" stroke="currentColor">
          <ellipse cx="120" cy="110" rx="70" ry="95" transform="rotate(-24 120 110)" />
          <ellipse cx="128" cy="118" rx="60" ry="88" transform="rotate(-12 128 118)" />
          <ellipse cx="136" cy="126" rx="52" ry="80" transform="rotate(4 136 126)" />
        </svg>
        <Reveal className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-28">
          <Heading>{a.numbersTitle}</Heading>
          <dl className={`mt-14 grid gap-y-12 sm:grid-cols-2 ${stats.length === 4 ? "lg:grid-cols-4" : ""}`}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="num text-[48px] leading-none font-semibold tracking-[-0.04em] sm:text-[60px]">{stat.value}</dd>
                <dt className="mx-auto mt-3 max-w-44 text-[15px] text-ink-2">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-28 sm:px-6 sm:pt-36">
        <Reveal>
          <Heading className="text-center">{a.principlesTitle}</Heading>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {a.principles.map((principle, index) => (
            <Reveal key={principle.title} delay={(index % 2) * 100}>
              <div className="flex h-full gap-5 rounded-[28px] border border-line bg-paper p-7 transition-shadow hover:shadow-float sm:p-8">
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${MIST} text-buy`}>
                  <svg
                    viewBox="0 0 24 24"
                    className="size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {ICONS[index]}
                  </svg>
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{principle.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{principle.body}</p>
                  {index === 1 && (
                    <p className="mt-4 flex gap-5 text-sm font-medium">
                      <Link href={href("/methodology")} className="group inline-flex items-center gap-1.5 hover:text-ink-2">
                        {a.methodology}
                        <Arrow className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      {dataDocs && (
                        // eslint-disable-next-line @next/next/no-html-link-for-pages -- static dbt docs in public/, not a page
                        <a href="/data-docs/index.html" className="group inline-flex items-center gap-1.5 hover:text-ink-2">
                          {a.dataModel}
                          <Arrow className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
                        </a>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-28 pb-28 sm:px-6 sm:pt-36 sm:pb-36">
        <Reveal>
          <div className="grid overflow-hidden rounded-[32px] border border-line bg-paper shadow-float lg:grid-cols-[0.85fr_1.15fr]">
            <div className={`relative min-h-56 overflow-hidden ${NIGHT}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
              <img
                src="/about/finland-dots.svg"
                alt=""
                className="absolute -bottom-6 left-[38%] w-[130%] max-w-none -translate-x-1/2 opacity-80"
              />
              <span className="absolute bottom-6 left-6 flex size-14 items-center justify-center rounded-2xl bg-white/[0.08] text-white ring-1 ring-white/15 backdrop-blur-md">
                <LogoMark size={32} />
              </span>
            </div>
            <div className="p-8 sm:p-12">
              <h3 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[30px]">{a.contactTitle}</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{a.contactBody}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group mt-8 flex h-12 w-fit max-w-full items-center gap-2 rounded-xl bg-buy px-6 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                <span className="truncate">{CONTACT_EMAIL}</span>
                <Arrow className="shrink-0 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
