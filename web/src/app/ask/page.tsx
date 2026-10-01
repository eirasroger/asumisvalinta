"use client";

import Link from "next/link";
import { useState } from "react";
import { type AskResponse, api } from "@/lib/api";

const EXAMPLES = [
  "What was the average price per m² of flats in postal code 00100 in 2025 Q4?",
  "How much did prices of old flats in Helsinki change from a year earlier in 2025 Q4?",
  "What is the average rent per m² in new agreements for two-room flats in Tampere?",
  "Compare buying and renting a 55 m² two-room flat in 00100 over 5 years.",
];

const STATUS_LABELS: Record<AskResponse["status"], string> = {
  answered: "Answer",
  refused: "Outside what the data covers",
  needs_clarification: "More detail needed",
  error: "Something went wrong",
};

function sessionId() {
  try {
    const stored = sessionStorage.getItem("asumisvalinta-session");
    if (stored) return stored;
    const created = crypto.randomUUID();
    sessionStorage.setItem("asumisvalinta-session", created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
    setLoading(true);
    setError(null);
    try {
      setAnswer(await api.ask(text, sessionId()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10 pb-16 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Ask about the housing market</h1>
      </header>

      <form
        className="overflow-hidden rounded-xl border border-line bg-paper focus-within:border-line-strong"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim().length >= 3) submit(question.trim());
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && question.trim().length >= 3) {
              event.preventDefault();
              submit(question.trim());
            }
          }}
          maxLength={500}
          rows={3}
          aria-label="Your question"
          placeholder="For example: what is the average rent per m² for one-room flats in Oulu?"
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] outline-none placeholder:text-ink-3"
        />
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
          <p className="mr-auto pl-1 text-xs text-ink-3">
            Leave out personal information.{" "}
            <Link href="/privacy" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
              Privacy
            </Link>
            {answer ? ` ${answer.remaining_questions} questions left in this session.` : ""}
          </p>
          <button type="submit" disabled={loading || question.trim().length < 3} className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40">
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      {!answer && !loading && (
        <div className="grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-xl border border-line bg-paper px-4 py-3 text-left text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
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
          <p className="text-[13px] font-medium text-ink-3">{STATUS_LABELS[answer.status]}</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-line">{answer.answer}</p>
          {answer.sources && (
            <div className="space-y-1 border-t border-line pt-3 text-xs text-ink-3">
              {answer.sources && (
                <p>
                  <span className="font-medium text-ink-2">Based on </span>
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
