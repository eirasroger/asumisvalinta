export const LINK = "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink";
export const LIST =
  "space-y-3 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:top-[0.75em] [&>li]:before:left-0.5 [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-buy";

export interface LegalText {
  title: string;
  intro: string;
  updated: string;
  contents: string;
  sections: { title: string; body: React.ReactNode }[];
}

/** A legal page such as the privacy notice: numbered sections with a table of contents. */
export function LegalView({ text }: { text: LegalText }) {
  return (
    <div className="bg-paper">
      <header className="relative overflow-hidden bg-[#0e1a26] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
        <img
          src="/about/finland-dots.svg"
          alt=""
          className="map-reveal pointer-events-none absolute top-[-60%] right-[2%] w-[340px] opacity-40 [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:w-[520px]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
          <h1 className="fade-up text-[44px] leading-none font-semibold tracking-[-0.04em] sm:text-[76px]">{text.title}</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
        <nav aria-label={text.contents} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-medium tracking-wider text-ink-3 uppercase">{text.contents}</p>
            <ol className="mt-4 space-y-2.5 border-l border-line">
              {text.sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#section-${index + 1}`}
                    className="-ml-px block border-l border-transparent pl-4 text-sm text-ink-2 transition-colors hover:border-ink hover:text-ink"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-[680px] min-w-0 text-[16px] leading-[1.8] text-ink-2">
          <p className="text-lg leading-relaxed text-ink">{text.intro}</p>
          <p className="mt-2 text-sm text-ink-3">{text.updated}</p>
          {text.sections.map((section, index) => (
            <section key={section.title} id={`section-${index + 1}`} className="mt-14 scroll-mt-24">
              <h2 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">{section.title}</h2>
              <div>{section.body}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
