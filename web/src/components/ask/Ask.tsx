"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { type AskResponse, api } from "@/lib/api";

// Kept in memory only: nothing is stored on the device, and a reload starts a new session.
let currentSession: string | null = null;
let consentGiven = false;

function sessionId() {
  currentSession ??= crypto.randomUUID();
  return currentSession;
}

export function Ask() {
  const { t, locale, href } = useI18n();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(consentGiven);

  async function submit(text: string) {
    setLoading(true);
    setError(null);
    try {
      setAnswer(await api.ask(text, sessionId(), locale, consent));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.ask.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10 pb-16 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{t.ask.title}</h1>
      </header>

      {!consent && (
        <section className="space-y-3 rounded-xl border border-line bg-paper p-5 text-sm leading-relaxed">
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

      <form
        className={`overflow-hidden rounded-xl border border-line bg-paper focus-within:border-line-strong ${consent ? "" : "opacity-50"}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (consent && question.trim().length >= 3) submit(question.trim());
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && consent && question.trim().length >= 3) {
              event.preventDefault();
              submit(question.trim());
            }
          }}
          maxLength={500}
          rows={3}
          disabled={!consent}
          aria-label={t.ask.question}
          placeholder={t.ask.placeholder}
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] outline-none placeholder:text-ink-3"
        />
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
          <p className="mr-auto pl-1 text-xs text-ink-3">
            {t.ask.personal}{" "}
            <Link href={href("/privacy")} className="underline decoration-line-strong underline-offset-2 hover:text-ink">
              {t.ask.privacy}
            </Link>
            {answer ? t.ask.remaining(answer.remaining_questions) : ""}
          </p>
          <button type="submit" disabled={!consent || loading || question.trim().length < 3} className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40">
            {loading ? t.ask.thinking : t.ask.submit}
          </button>
        </div>
      </form>

      {!answer && !loading && (
        <div className="grid gap-2 sm:grid-cols-2">
          {t.ask.examples.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-xl border border-line bg-paper px-4 py-3 text-left text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              disabled={!consent}
              onClick={() => setQuestion(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="relative h-24 overflow-hidden rounded-xl border border-line bg-paper">
          <div className="busy absolute inset-x-0 top-0 h-0.5 overflow-hidden" />
        </div>
      )}

      {error && <p className="rounded-xl border border-line bg-paper p-4 text-sm text-bad">{error}</p>}

      {answer && !loading && (
        <article className="space-y-4 rounded-xl border border-line bg-paper p-5">
          <p className="text-[13px] font-medium text-ink-3">{t.ask.status[answer.status]}</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{answer.answer}</p>
          {answer.sources && (
            <div className="space-y-1 border-t border-line pt-3 text-xs text-ink-3">
              {answer.sources && (
                <p>
                  <span className="font-medium text-ink-2">{t.ask.basedOn}</span>
                  {answer.sources}
                </p>
              )}
            </div>
          )}
        </article>
      )}
    </div>
  );
}
