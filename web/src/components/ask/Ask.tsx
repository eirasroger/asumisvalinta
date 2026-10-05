"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { AnswerChart } from "@/components/ask/AnswerChart";
import { LogoMark } from "@/components/Logo";
import { NIGHT } from "@/components/showcase";
import { ApiError, type AskResponse, type AskTurn, api } from "@/lib/api";

/** Earlier exchanges sent with each question (API maximum). */
const MEMORY_TURNS = 4;
/** Matches throttle.ASK_INTERVAL_SECONDS in the API. */
const ASK_INTERVAL_SECONDS = 15;

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

/** Animates height changes of its content. */
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

/** Reveals the text word by word. */
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
      className="message-in max-w-[85%] min-w-0 flex-1 origin-bottom-left rounded-2xl rounded-bl-md bg-paper shadow-float ring-1 ring-line"
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
          {answer?.chart && <AnswerChart chart={answer.chart} delay={Math.min(1300, words * 22)} />}
          {answer?.sources && (
            <p
              className="soft-in mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-3"
              style={{ animationDelay: `${Math.min(1300, words * 22) + (answer.chart ? 700 : 150)}ms` }}
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

const Avatar = ({ size = "size-8" }: { size?: string }) => (
  <span className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-paper ring-1 ring-line`}>
    <LogoMark size={18} className="text-ink" />
  </span>
);

/** Seconds left on the send button, drawn as a shrinking ring. */
function Countdown({ seconds, share }: { seconds: number; share: number }) {
  return (
    <span className="relative flex size-10 items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - share}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <span className="num text-[13px] font-semibold text-ink">{seconds}</span>
    </span>
  );
}

export function Ask() {
  const { t, locale, href } = useI18n();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [consent, setConsent] = useState(consentGiven);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const nextId = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const loading = turns.some((turn) => !turn.answer && !turn.error);
  const wait = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const ready = consent && !loading && wait === 0 && question.trim().length >= 3;

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= cooldownUntil) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const coolDown = (seconds: number) => {
    setNow(Date.now());
    setCooldownUntil(Date.now() + seconds * 1000);
  };

  async function submit() {
    if (!ready) return;
    const text = question.trim();
    const id = nextId.current++;
    const history: AskTurn[] = turns
      .flatMap((turn) =>
        turn.answer?.signature ? [{ question: turn.question, answer: turn.answer.answer, signature: turn.answer.signature }] : [],
      )
      .slice(-MEMORY_TURNS);
    setQuestion("");
    setTurns((current) => [...current, { id, question: text }]);
    coolDown(ASK_INTERVAL_SECONDS);
    const settle = (patch: Partial<Turn>) =>
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
    try {
      const answer = await api.ask(text, sessionId(), locale, consent, history);
      setRemaining(answer.remaining_questions);
      settle({ answer });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429 && caught.retryAfter) {
        setTurns((current) => current.filter((turn) => turn.id !== id));
        setQuestion((current) => current || text);
        coolDown(caught.retryAfter);
        return;
      }
      settle({ error: caught instanceof Error ? caught.message : t.ask.failed });
    }
  }

  return (
    <div className="pb-16">
      <section className={`relative overflow-hidden ${NIGHT} text-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
        <img
          src="/about/finland-dots.svg"
          alt=""
          className="map-reveal pointer-events-none absolute top-[-60%] right-[2%] w-[300px] opacity-40 [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:w-[460px]"
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-14 pb-32 sm:px-6 sm:pt-20">
          <h1 className="fade-up flex flex-wrap items-center gap-x-3 gap-y-2 text-[34px] leading-none font-semibold tracking-[-0.035em] sm:text-[48px]">
            {t.ask.title}
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium tracking-normal text-white/80 ring-1 ring-white/30">
              {t.ask.beta}
            </span>
          </h1>
          <p className="fade-up mt-4 max-w-xl text-[15px] leading-relaxed text-white/60" style={{ animationDelay: "120ms" }}>
            {t.ask.betaNotice}
          </p>
        </div>
      </section>

      <div className="relative mx-auto -mt-20 max-w-3xl px-4 sm:px-6">
        <div
          className="fade-up flex h-[min(760px,calc(100dvh-7rem))] min-h-[520px] flex-col overflow-hidden rounded-[28px] bg-paper shadow-[0_24px_60px_-20px_rgba(14,26,38,0.35)] ring-1 ring-line"
          style={{ animationDelay: "200ms" }}
        >
          <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <Avatar />
            <p className="mr-auto text-sm font-semibold">{t.ask.assistant}</p>
            {turns.length > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setTurns([]);
                  field.current?.focus();
                }}
                className="h-8 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
              >
                {t.ask.newConversation}
              </button>
            )}
          </header>

          <div ref={thread} className="flex-1 overflow-y-auto bg-frost px-4 py-6 sm:px-6">
            {!consent && (
              <section className="mx-auto max-w-lg space-y-3 rounded-2xl bg-paper p-5 text-sm leading-relaxed ring-1 ring-line">
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
            {consent && turns.length === 0 && (
              <div className="soft-in flex h-full flex-col items-center justify-center gap-4 text-center">
                <Avatar size="size-14" />
                <p className="text-lg font-semibold tracking-tight">{t.ask.emptyTitle}</p>
              </div>
            )}
            {turns.length > 0 && (
              <ol className="space-y-6">
                {turns.map((turn) => (
                  <li key={turn.id} className="space-y-4">
                    <p className="message-in ml-auto w-fit max-w-[85%] origin-bottom-right rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[15px] leading-relaxed text-paper">
                      {turn.question}
                    </p>
                    <div className="flex items-end gap-2.5">
                      <span className="message-in hidden sm:block" style={{ animationDelay: "140ms" }}>
                        <Avatar />
                      </span>
                      <AnswerCard turn={turn} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <form
            className={`border-t border-line bg-paper ${consent ? "" : "opacity-50"}`}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex items-end gap-2 p-3 pl-5">
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
              {wait > 0 && !loading ? (
                <span role="status" aria-label={t.ask.wait(wait)}>
                  <Countdown seconds={wait} share={(cooldownUntil - now) / (ASK_INTERVAL_SECONDS * 1000)} />
                </span>
              ) : (
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
              )}
            </div>
            <p className="px-5 pb-3 text-xs text-ink-3">
              {t.ask.personal}{" "}
              <Link href={href("/privacy")} className="underline decoration-line-strong underline-offset-2 hover:text-ink">
                {t.ask.privacy}
              </Link>
              {remaining !== null ? t.ask.remaining(remaining) : ""}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
