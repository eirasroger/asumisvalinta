"use client";

import { useEffect, useState } from "react";

interface Section {
  id: string;
  title: string;
}

/** Shows sections as they scroll into view; content already on screen shows at once, so nothing flickers. */
function useReveal() {
  useEffect(() => {
    let pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    // Everything above the reading line is shown, so a jump from the contents never skips a section.
    const update = () => {
      const line = window.innerHeight * 0.9;
      pending = pending.filter((item) => {
        if (item.getBoundingClientRect().top >= line) return true;
        item.classList.add("revealed");
        return false;
      });
      if (!pending.length) window.removeEventListener("scroll", onScroll);
    };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    document.documentElement.classList.add("reveal-ready");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.classList.remove("reveal-ready");
    };
  }, []);
}

/** The section whose top last passed the reading line, a third of the way down the screen. */
function useActiveSection(sections: Section[]) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight / 3;
      let current = sections[0]?.id ?? "";
      for (const { id } of sections) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);
  return active;
}

/** How far the reader is through the article, from 0 to 1. */
function useProgress(articleId: string) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const article = document.getElementById(articleId);
      if (!article) return;
      const { top, height } = article.getBoundingClientRect();
      const total = height - window.innerHeight;
      setProgress(total > 0 ? Math.min(1, Math.max(0, -top / total)) : 1);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [articleId]);
  return progress;
}

export function ReadingProgress({ articleId }: { articleId: string }) {
  const progress = useProgress(articleId);
  useReveal();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-14 z-30 h-[3px] bg-transparent">
      <div className="h-full origin-left bg-buy transition-transform duration-150 ease-out" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

const ITEM = "-ml-px flex items-baseline gap-3 border-l py-1 pl-4 text-sm transition-colors";

export function SectionNav({ sections, label }: { sections: Section[]; label: string }) {
  const active = useActiveSection(sections);
  return (
    <nav aria-label={label} className="hidden lg:block">
      <div className="sticky top-24">
        <p className="text-xs font-medium tracking-wider text-ink-3 uppercase">{label}</p>
        <ol className="mt-4 border-l border-line">
          {sections.map((section, index) => {
            const current = section.id === active;
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={current ? "location" : undefined}
                  className={`${ITEM} ${current ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink"}`}
                >
                  <span className="num w-5 shrink-0 text-xs text-ink-3 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** On small screens: a bar under the header naming the current section, which opens the contents. */
export function MobileSectionNav({ sections, label }: { sections: Section[]; label: string }) {
  const active = useActiveSection(sections);
  const [open, setOpen] = useState(false);
  const index = Math.max(0, sections.findIndex((section) => section.id === active));
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-8 border-b border-line bg-paper/95 backdrop-blur sm:-mx-6 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm sm:px-6"
      >
        <span className="num text-xs text-ink-3 tabular-nums">
          {String(index + 1).padStart(2, "0")}/{String(sections.length).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{sections[index]?.title ?? label}</span>
        <svg viewBox="0 0 16 16" aria-hidden className={`size-4 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ol aria-label={label} className="max-h-[60dvh] overflow-y-auto border-t border-line px-4 py-2 sm:px-6">
          {sections.map((section, i) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={() => setOpen(false)}
                className={`flex items-baseline gap-3 py-2 text-sm ${i === index ? "font-medium text-ink" : "text-ink-2"}`}
              >
                <span className="num w-5 shrink-0 text-xs text-ink-3 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(window.scrollY > 900);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={shown ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className={`fixed right-4 bottom-4 z-30 grid size-11 place-items-center rounded-full bg-ink text-paper shadow-float transition-[opacity,transform] duration-300 hover:-translate-y-0.5 sm:right-6 sm:bottom-6 ${shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4">
        <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
