import { Ask } from "@/components/ask/Ask";
import { pageMetadata } from "@/components/Shell";
import { DEFAULT_LOCALE } from "@/i18n/config";

export const metadata = pageMetadata(DEFAULT_LOCALE, "ask");

export default function Page() {
  return <Ask />;
}
