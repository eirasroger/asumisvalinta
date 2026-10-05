"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { type AskResponse, api } from "@/lib/api";

// Kept in memory only: nothing is stored on the device, and a reload starts a new session.
let currentSession: string | null = null;
let consentGiven = false;

function sessionId() {
  currentSession ??= crypto.randomUUID();
  return currentSession;
}

interface Turn {
  id: number;
  question: string;
  answer?: AskResponse;
  error?: string;
}

const STATUS_DOT: Record<AskResponse["status"], string> = {
  answered: "bg-aso",
  needs_clarification: "bg-buy",
  refused: "bg-rent",
  error: "bg-bad",
};

/** Follows its content's height, so the card grows smoothly when the answer replaces the placeholder. */
function SmoothHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ height }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

/** The answer text, revealed word by word within about a second. */
function RevealText({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  const step = Math.min(22, 1200 / Math.max(1, parts.length / 2));
  return (
    <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">
      {parts.map((part, index) =>
        /^\s+$/.test(part) || !part ? (
          part
        ) : (
          <span key={index} className="word-in" style={{ animationDelay: `${Math.round((index / 2) * step)}ms` }}>
            {part}
          </span>
        ),
      )}
    </p>
  );
}

function AnswerCard({ turn }: { turn: Turn }) {
  const { t } = useI18n();
  const { answer, error } = turn;
  const thinking = !answer && !error;
  const words = answer ? answer.answer.split(/\s+/).length : 0;
  return (
    <article
      className="message-in max-w-[90%] origin-bottom-left rounded-2xl rounded-bl-md bg-paper shadow-float ring-1 ring-line"
      style={{ animationDelay: "140ms" }}
      aria-live="polite"
      aria-busy={thinking}
    >
      <SmoothHeight>
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-xs font-medium text-ink-2">
            {thinking ? (
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="thinking-dot size-1.5 rounded-full bg-ink-3" style={{ animationDelay: `${dot * 160}ms` }} />
                ))}
              </span>
            ) : (
              <span className={`soft-in size-2 rounded-full ${error ? "bg-bad" : STATUS_DOT[answer!.status]}`} />
            )}
            <span key={thinking ? "thinking" : "done"} className="soft-in">
              {thinking ? t.ask.thinking : error ? t.ask.status.error : t.ask.status[answer!.status]}
            </span>
          </p>
          {thinking && (
            <div className="mt-4 space-y-2.5" aria-hidden="true">
              <span className="shimmer block h-2 w-[88%] rounded-full" />
              <span className="shimmer block h-2 w-[72%] rounded-full" />
              <span className="shimmer block h-2 w-[46%] rounded-full" />
            </div>
          )}
          {error && <p className="soft-in mt-3 text-sm text-bad">{error}</p>}
          {answer && <RevealText text={answer.answer} />}
          {answer?.sources && (
            <p
              className="soft-in mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-3"
              style={{ animationDelay: `${Math.min(1300, words * 22) + 150}ms` }}
            >
              <span className="font-medium text-ink-2">{t.ask.basedOn}</span>
              {answer.sources}
            </p>
          )}
        </div>
      </SmoothHeight>
    </article>
  );
}

export function Ask() {
  const { t, locale, href } = useI18n();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [consent, setConsent] = useState(consentGiven);
  const nextId = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const loading = turns.some((turn) => !turn.answer && !turn.error);
  const ready = consent && !loading && question.trim().length >= 3;

  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function submit() {
    if (!ready) return;
    const text = question.trim();
    const id = nextId.current++;
    setQuestion("");
    setTurns((current) => [...current, { id, question: text }]);
    const settle = (patch: Partial<Turn>) =>
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
    try {
      const answer = await api.ask(text, sessionId(), locale, consent);
      setRemaining(answer.remaining_questions);
      settle({ answer });
    } catch (caught) {
      settle({ error: caught instanceof Error ? caught.message : t.ask.failed });
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-4 pt-10 pb-6 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {t.ask.title}
            <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-medium tracking-normal text-ink-2">
              {t.ask.beta}
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-3">{t.ask.betaNotice}</p>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setTurns([]);
              field.current?.focus();
            }}
            className="h-9 shrink-0 rounded-lg border border-line bg-paper px-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            {t.ask.newConversation}
          </button>
        )}
      </header>

      {!consent && (
        <section className="mt-6 space-y-3 rounded-2xl border border-line bg-paper p-5 text-sm leading-relaxed">
          <p>{t.ask.consent}</p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                consentGiven = true;
                setConsent(true);
              }}
              className="h-9 rounded-lg bg-ink px-4 font-medium text-paper transition-opacity hover:opacity-90"
            >
              {t.ask.agree}
            </button>
            <Link href={href("/privacy")} className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
              {t.ask.privacy}
            </Link>
          </div>
        </section>
      )}

      <div className="flex-1 py-8">
        {turns.length > 0 && (
          <ol className="space-y-6">
            {turns.map((turn) => (
              <li key={turn.id} className="space-y-4">
                <p className="message-in ml-auto w-fit max-w-[85%] origin-bottom-right rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[15px] leading-relaxed text-paper">
                  {turn.question}
                </p>
                <AnswerCard turn={turn} />
              </li>
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      <form
        className={`sticky bottom-4 rounded-2xl border border-line bg-paper shadow-float focus-within:border-line-strong ${consent ? "" : "opacity-50"}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 p-2 pl-4">
          <textarea
            ref={field}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            maxLength={500}
            rows={2}
            disabled={!consent}
            aria-label={t.ask.question}
            placeholder={t.ask.placeholder}
            className="block max-h-40 min-h-12 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-3 focus-visible:outline-none!"
          />
          <button
            type="submit"
            disabled={!ready}
            aria-label={t.ask.submit}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-90 disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 13V3.5M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
          {t.ask.personal}{" "}
          <Link href={href("/privacy")} className="underline decoration-line-strong underline-offset-2 hover:text-ink">
            {t.ask.privacy}
          </Link>
          {remaining !== null ? t.ask.remaining(remaining) : ""}
        </p>
      </form>
    </div>
  );
}
