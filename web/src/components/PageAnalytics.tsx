"use client";

import { Analytics } from "@vercel/analytics/next";
import { trackingAllowed } from "@/lib/analytics";

export function PageAnalytics() {
  return <Analytics beforeSend={(event) => (trackingAllowed() ? event : null)} />;
}
