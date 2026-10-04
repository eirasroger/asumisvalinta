import type { Locale } from "@/i18n/config";
import { en, type Messages } from "./en";
import { fi } from "./fi";

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { fi, en };
