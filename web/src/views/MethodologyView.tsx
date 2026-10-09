import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AdSlot } from "@/components/AdSlot";
import { Arrow } from "@/components/icons";
import { BackToTop, MobileSectionNav, ReadingProgress, SectionNav } from "@/components/methodology/ReadingNav";
import { DEFAULT_LOCALE, type Locale, localePath } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { headingId } from "@/lib/guides";
import { GuideHero } from "@/views/GuideView";

const ARTICLE = "methodology";

/** content/methodology.md is English; other languages add their code, as in methodology.fi.md. */
async function methodology(locale: Locale) {
  const name = locale === "en" ? "methodology.md" : `methodology.${locale}.md`;
  return (await readFile(path.join(process.cwd(), "..", "content", name), "utf-8")).replace(/\r\n/g, "\n");
}

interface Section {
  id: string;
  title: string;
  body: string;
}

/** The title, the lead paragraph and the `## ` sections of the text. */
function parse(text: string) {
  const [, title = "", lead = "", rest = ""] = text.match(/^# (.+)\n+([^\n]+)\n+([\s\S]*)$/) ?? [];
  const sections: Section[] = rest
    .split(/^## /m)
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [heading, ...body] = chunk.split("\n");
      return { id: headingId(heading), title: heading.trim(), body: body.join("\n") };
    });
  return { title, lead, sections };
}

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => (typeof child === "string" ? child : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : ""))
    .join("");

/** Rows of `label | expression`, set as a formula sheet. */
function FormulaBlock({ source }: { source: string }) {
  const rows = source
    .trim()
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()));
  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-line bg-paper">
      <dl className="divide-y divide-line">
        {rows.map(([label, expression]) => (
          <div key={label} className="grid gap-1 px-5 py-3.5 transition-colors hover:bg-frost sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
            <dt className="text-[13px] font-medium text-ink-3 sm:pt-px">{label}</dt>
            <dd className="text-[15px] leading-relaxed font-medium text-ink">{expression}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Rows of `title | text`, set as a numbered sequence. */
function StepsBlock({ source }: { source: string }) {
  const steps = source
    .trim()
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()));
  return (
    <ol className="my-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map(([title, text], index) => (
        <li
          key={title}
          className="relative rounded-2xl border border-line bg-paper p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-float"
        >
          <span className="block h-1 w-8 rounded-full bg-ink" />
          <span className="num mt-4 block text-xs text-ink-3 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="mt-1 block text-[15px] font-semibold text-ink">{title}</span>
          <span className="mt-2 block text-sm leading-relaxed text-ink-2">{text}</span>
        </li>
      ))}
    </ol>
  );
}

const LIST =
  "mb-5 space-y-2.5 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:top-[0.75em] [&>li]:before:left-0.5 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-buy";

function MethodologyMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h3: (props) => <h3 className="mt-10 mb-3 text-lg font-semibold tracking-tight text-ink" {...props} />,
        p: (props) => <p className="mb-5" {...props} />,
        ul: (props) => <ul className={LIST} {...props} />,
        ol: (props) => <ol className="mb-5 list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-ink-3" {...props} />,
        a: (props) => <a className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink" {...props} />,
        strong: (props) => <strong className="font-semibold text-ink" {...props} />,
        pre: ({ node, children }) => {
          const code = node?.children[0];
          const classes = code?.type === "element" ? [code.properties.className].flat() : [];
          if (classes.includes("language-formula")) return <FormulaBlock source={textOf(children)} />;
          if (classes.includes("language-steps")) return <StepsBlock source={textOf(children)} />;
          return <pre>{children}</pre>;
        },
        table: (props) => (
          <div className="my-6 overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="w-full text-[14px] leading-snug" {...props} />
          </div>
        ),
        tr: (props) => <tr className="transition-colors hover:bg-frost" {...props} />,
        th: (props) => <th className="bg-frost px-4 py-3 text-left text-[13px] font-semibold text-ink" {...props} />,
        td: (props) => <td className="border-t border-line px-4 py-3 align-top text-ink-2 first:font-medium first:text-ink" {...props} />,
        code: (props) => <code className="rounded bg-well px-1 py-0.5 text-[13px]" {...props} />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function MethodologySection({ section, index, copyLink }: { section: Section; index: number; copyLink: string }) {
  return (
    <section id={section.id} data-reveal className="reveal scroll-mt-28 pt-14 first:pt-0 lg:scroll-mt-24">
      <p className="num text-xs font-medium tracking-wider text-buy tabular-nums">{String(index + 1).padStart(2, "0")}</p>
      <h2 className="group mt-2 mb-5 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
        {section.title}
        <a
          href={`#${section.id}`}
          aria-label={copyLink}
          className="ml-2 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          #
        </a>
      </h2>
      <MethodologyMarkdown markdown={section.body} />
    </section>
  );
}

export async function MethodologyView({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = MESSAGES[locale].methodology;
  const { title, lead, sections } = parse(await methodology(locale));
  const middle = sections.length >= 4 ? Math.floor(sections.length / 2) : -1;
  const nav = sections.map(({ id, title }) => ({ id, title }));
  return (
    <div className="bg-paper">
      <ReadingProgress articleId={ARTICLE} />
      <GuideHero locale={locale} title={title} lead={lead} />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-20">
        <SectionNav sections={nav} label={t.contents} />
        <article id={ARTICLE} className="max-w-[720px] min-w-0 text-[16px] leading-[1.8] text-ink-2">
          <MobileSectionNav sections={nav} label={t.contents} />
          {sections.map((section, index) => (
            <Fragment key={section.id}>
              {index === middle && <AdSlot className="my-12" />}
              <MethodologySection section={section} index={index} copyLink={t.copyLink} />
            </Fragment>
          ))}
          <aside data-reveal className="reveal mt-16 overflow-hidden rounded-[24px] bg-[#0e1a26] p-8 text-white sm:p-10">
            <p className="text-2xl font-semibold tracking-[-0.02em]">{t.ctaTitle}</p>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">{t.ctaBody}</p>
            <Link
              href={localePath(locale, "/compare")}
              className="group mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-medium text-ink transition-transform hover:-translate-y-0.5"
            >
              {t.cta}
              <Arrow className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </aside>
          <AdSlot className="mt-14" />
        </article>
      </div>
      <BackToTop label={t.backToTop} />
    </div>
  );
}
