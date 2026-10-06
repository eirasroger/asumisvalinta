"use client";

import Link from "next/link";
import { Arrow } from "@/components/icons";
import { useI18n } from "@/i18n/I18nProvider";

export function GuideLink({ slug, children, className = "" }: { slug: string; children: React.ReactNode; className?: string }) {
  const { href } = useI18n();
  return (
    <Link
      href={href(`/oppaat/${slug}`)}
      className={`group inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink ${className}`}
    >
      <span className="underline decoration-line-strong underline-offset-4 transition-colors group-hover:decoration-ink">{children}</span>
      <Arrow className="size-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
