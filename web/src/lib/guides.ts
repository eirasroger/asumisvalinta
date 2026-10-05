import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "@/i18n/config";

const DIR = path.join(process.cwd(), "..", "content", "guides");

export interface Guide {
  slug: string;
  title: string;
  description: string;
  updated: string;
  body: string;
  sections: { id: string; title: string }[];
}

/** URL fragment for a heading, the same on the page and in its table of contents. */
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** `<slug>.md` is English; other languages add their code, as in `<slug>.fi.md`. */
export async function guideSlugs() {
  return (await readdir(DIR)).filter((name) => /^[a-z0-9-]+\.md$/.test(name)).map((name) => name.slice(0, -3));
}

export async function loadGuide(slug: string, locale: Locale): Promise<Guide> {
  const name = locale === "en" ? `${slug}.md` : `${slug}.${locale}.md`;
  const text = (await readFile(path.join(DIR, name), "utf-8")).replace(/\r\n/g, "\n");
  const [, head = "", body = text] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const field = (key: string) => head.match(new RegExp(`^${key}: (.*)$`, "m"))?.[1].trim() ?? "";
  const sections = [...body.matchAll(/^## (.+)$/gm)].map(([, title]) => ({ id: headingId(title), title }));
  return { slug, title: field("title"), description: field("description"), updated: field("updated"), body, sections };
}

export async function loadGuides(locale: Locale) {
  return Promise.all((await guideSlugs()).map((slug) => loadGuide(slug, locale)));
}

export type GuideCard = Pick<Guide, "slug" | "title" | "description">;

export async function guideCards(locale: Locale): Promise<GuideCard[]> {
  return (await loadGuides(locale)).map(({ slug, title, description }) => ({ slug, title, description }));
}
