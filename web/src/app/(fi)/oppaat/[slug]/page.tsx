import { articleMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { guideSlugs, loadGuide } from "@/lib/guides";
import { GuideView } from "@/views/GuideView";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await guideSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guide = await loadGuide(slug, DEFAULT_LOCALE);
  return articleMetadata(DEFAULT_LOCALE, `/oppaat/${slug}`, guide.title, guide.description);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <GuideView locale={DEFAULT_LOCALE} guide={await loadGuide(slug, DEFAULT_LOCALE)} />;
}
