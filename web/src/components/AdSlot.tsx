"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { ADS_LIVE, ADSENSE_CLIENT, ADSENSE_SLOT } from "@/lib/site";

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

/** One responsive AdSense unit, shown once AdSense is set up. */
export function AdSlot({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const unit = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADS_LIVE || unit.current?.dataset.adsbygoogleStatus) return;
    (window.adsbygoogle ??= []).push({});
  }, []);

  if (!ADS_LIVE) return null;
  return (
    <aside aria-label={t.ads.label} className={`ad-slot ${className}`}>
      <ins
        ref={unit}
        className="adsbygoogle block min-h-[280px]"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
