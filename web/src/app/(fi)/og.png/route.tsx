import { DEFAULT_LOCALE } from "@/i18n/config";
import { ogImage } from "@/lib/ogImage";

export const dynamic = "force-static";

export function GET() {
  return ogImage(DEFAULT_LOCALE);
}
