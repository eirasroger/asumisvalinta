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
    <article className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="mb-4 text-2xl font-semibold tracking-tight sm:text-[28px]" {...props} />,
          h2: (props) => <h2 className="mt-10 mb-3 border-t border-line pt-6 text-lg font-semibold tracking-tight" {...props} />,
          h3: (props) => <h3 className="mt-6 mb-2 text-[15px] font-semibold" {...props} />,
          p: (props) => <p className="mb-3 text-[15px] leading-relaxed text-ink-2" {...props} />,
          ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink-2" {...props} />,
          ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-ink-2" {...props} />,
          a: (props) => <a className="link" {...props} />,
          strong: (props) => <strong className="font-semibold text-ink" {...props} />,
          table: (props) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-line bg-paper">
              <table className="w-full text-[13px]" {...props} />
            </div>
          ),
          th: (props) => <th className="px-3 py-2 text-left text-xs font-medium text-ink-3" {...props} />,
          td: (props) => <td className="border-t border-line px-3 py-2 align-top text-ink-2" {...props} />,
          code: (props) => <code className="rounded bg-well px-1 py-0.5 text-[13px]" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </article>
  );
}
