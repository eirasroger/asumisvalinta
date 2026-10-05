"use client";

import { useEffect } from "react";
import { trackingAllowed } from "@/lib/analytics";
import { ANALYTICS_TOKEN } from "@/lib/site";

export function PageAnalytics() {
  useEffect(() => {
    if (!ANALYTICS_TOKEN || !trackingAllowed()) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS_TOKEN });
    document.body.appendChild(script);
  }, []);
  return null;
}
