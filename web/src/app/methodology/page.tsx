import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata = { title: "Methodology · Asumisvalinta" };

async function methodology() {
  return readFile(path.join(process.cwd(), "..", "content", "methodology.md"), "utf-8");
}

export default async function MethodologyPage() {
  const text = await methodology();
  return (
    <article className="methodology max-w-3xl space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="text-3xl font-semibold" {...props} />,
          h2: (props) => <h2 className="pt-4 text-xl font-semibold" {...props} />,
          p: (props) => <p className="text-ink-secondary" {...props} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-5 text-ink-secondary" {...props} />,
          table: (props) => (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm" {...props} />
            </div>
          ),
          th: (props) => <th className="p-2 text-left font-medium" {...props} />,
          td: (props) => <td className="border-t border-border p-2 align-top text-ink-secondary" {...props} />,
          code: (props) => <code className="rounded bg-page px-1 text-sm" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </article>
  );
}
