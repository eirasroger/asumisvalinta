import { Shell, siteMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";

export const metadata = siteMetadata(DEFAULT_LOCALE);

export default function DefaultLocaleLayout({ children }: { children: React.ReactNode }) {
  return <Shell locale={DEFAULT_LOCALE}>{children}</Shell>;
}
