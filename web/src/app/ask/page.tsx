"use client";

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
    <div className="max-w-3xl space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Ask about the housing market</h1>
        <p className="text-ink-secondary">
          An assistant answers with the governed metrics of this site and the scenario calculator. It
          reports only numbers the tools return and tells you which data it used.
        </p>
        <p className="rounded-md border border-border bg-surface p-3 text-sm text-ink-secondary">
          Your question is sent to OpenAI to be answered. Do not include personal information. The
          number of questions per session and per day is limited.
        </p>
      </section>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim().length >= 3) submit(question.trim());
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="For example: what is the average rent per m² for one-room flats in Oulu?"
          className="w-full rounded-md border border-border bg-surface p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
          {answer && (
            <span className="text-xs text-ink-muted">{answer.remaining_questions} questions left in this session</span>
          )}
        </div>
      </form>

      <div className="space-y-1">
        <p className="text-sm text-ink-secondary">Examples</p>
        <ul className="space-y-1">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button type="button" className="text-left text-sm underline" onClick={() => setQuestion(example)}>
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      {answer && (
        <article className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">{STATUS_LABELS[answer.status]}</p>
          <p className="whitespace-pre-line">{answer.answer}</p>
          {answer.sources && (
            <p className="text-sm text-ink-secondary">
              <span className="font-medium text-ink">Based on: </span>
              {answer.sources}
            </p>
          )}
          {answer.tools_used.length > 0 && (
            <p className="text-xs text-ink-muted">Tools used: {answer.tools_used.join(", ")}</p>
          )}
        </article>
      )}
    </div>
  );
}
