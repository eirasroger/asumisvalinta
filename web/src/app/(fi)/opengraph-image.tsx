import { DEFAULT_LOCALE } from "@/i18n/config";
import { OG_SIZE, ogAlt, ogImage } from "@/lib/ogImage";

export const alt = ogAlt(DEFAULT_LOCALE);
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage(DEFAULT_LOCALE);
}
