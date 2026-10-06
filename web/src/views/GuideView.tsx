import Link from "next/link";
import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Arrow } from "@/components/icons";
import { NIGHT } from "@/components/showcase";
import { type Locale, localePath } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { type Guide, headingId } from "@/lib/guides";

const LINK = "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const LIST =
  "mb-5 space-y-2.5 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:top-[0.75em] [&>li]:before:left-0.5 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-buy";

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => (typeof child === "string" ? child : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : ""))
    .join("");

export function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", { dateStyle: "long" }).format(new Date(iso));
}

export function GuideHero({ locale, title, lead, back }: { locale: Locale; title: string; lead: string; back?: boolean }) {
  const t = MESSAGES[locale].guides;
  return (
    <header className={`relative overflow-hidden ${NIGHT} text-white`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img
        src="/about/finland-dots.svg"
        alt=""
        className="map-reveal pointer-events-none absolute top-[-60%] right-[2%] w-[300px] opacity-40 [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:w-[480px]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-20">
        {back && (
          <Link href={localePath(locale, "/oppaat")} className="fade-up inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <Arrow className="rotate-180" />
            {t.title}
          </Link>
        )}
        <h1 className="fade-up mt-5 max-w-3xl text-[38px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[60px]">{title}</h1>
        <p className="fade-up mt-5 max-w-2xl text-lg leading-relaxed text-white/70" style={{ animationDelay: "120ms" }}>
          {lead}
        </p>
      </div>
    </header>
  );
}

export function GuideView({ locale, guide }: { locale: Locale; guide: Guide }) {
  const t = MESSAGES[locale].guides;
  return (
    <div className="bg-paper">
      <GuideHero locale={locale} title={guide.title} lead={guide.description} back />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
        <nav aria-label={t.contents} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-medium tracking-wider text-ink-3 uppercase">{t.contents}</p>
            <ol className="mt-4 space-y-2.5 border-l border-line">
              {guide.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="-ml-px block border-l border-transparent pl-4 text-sm text-ink-2 transition-colors hover:border-ink hover:text-ink">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-[680px] min-w-0 text-[16px] leading-[1.8] text-ink-2">
          <p className="mb-8 text-sm text-ink-3">{t.updated(formatDate(guide.updated, locale))}</p>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 id={headingId(textOf(children))} className="mt-14 mb-4 scroll-mt-24 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
                  {children}
                </h2>
              ),
              p: ({ node, children }) => {
                const only = node?.children.length === 1 ? node.children[0] : null;
                const href = only?.type === "element" && only.tagName === "a" ? String(only.properties.href ?? "") : "";
                if (href.startsWith("/")) {
                  return (
                    <p className="my-8">
                      <Link
                        href={localePath(locale, href)}
                        className="group inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-[15px] font-medium text-paper transition-transform hover:-translate-y-0.5"
                      >
                        {textOf(children)}
                        <Arrow className="transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </p>
                  );
                }
                return <p className="mb-5">{children}</p>;
              },
              ul: ({ children }) => <ul className={LIST}>{children}</ul>,
              ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-ink-3">{children}</ol>,
              strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
              table: ({ children }) => (
                <div className="my-6 overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full text-[14px] leading-snug">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="bg-frost px-4 py-3 text-left text-[13px] font-semibold text-ink">{children}</th>,
              td: ({ children }) => <td className="num border-t border-line px-4 py-3 whitespace-nowrap text-ink-2">{children}</td>,
              a: ({ href = "", children }) =>
                href.startsWith("/") ? (
                  <Link href={localePath(locale, href)} className={LINK}>
                    {children}
                  </Link>
                ) : (
                  <a href={href} className={LINK} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
            }}
          >
            {guide.body}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}

export function GuidesIndexView({ locale, guides }: { locale: Locale; guides: Guide[] }) {
  const t = MESSAGES[locale].guides;
  return (
    <div className="bg-paper">
      <GuideHero locale={locale} title={t.title} lead={t.lead} />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-12 pb-24 sm:grid-cols-2 sm:px-6 sm:pt-16 lg:grid-cols-3">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={localePath(locale, `/oppaat/${guide.slug}`)}
            className="group flex flex-col rounded-[24px] border border-line bg-paper p-7 transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-line-strong hover:shadow-float"
          >
            <h2 className="text-xl leading-snug font-semibold tracking-tight">{guide.title}</h2>
            <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-2">{guide.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium">
              {t.read}
              <Arrow className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
