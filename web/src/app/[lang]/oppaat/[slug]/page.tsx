import { articleMetadata } from "@/components/Shell";
import { guideSlugs, loadGuide } from "@/lib/guides";
import { GuideView } from "@/views/GuideView";
import { localeOf } from "../../locale";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await guideSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const locale = await localeOf({ params });
  const { slug } = await params;
  const guide = await loadGuide(slug, locale);
  return articleMetadata(locale, `/oppaat/${slug}`, guide.title, guide.description);
}

export default async function Page({ params }: Props) {
  const locale = await localeOf({ params });
  const { slug } = await params;
  return <GuideView locale={locale} guide={await loadGuide(slug, locale)} />;
}
