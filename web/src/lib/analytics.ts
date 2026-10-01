import type { Option, RoomType } from "@/lib/api";

export interface AreaEvent {
  type: "area";
  postal_code: string;
  room_type: RoomType;
  source: "map" | "search" | "compare";
  metric?: "price" | "rent" | "ratio";
}

export interface ScenarioEvent {
  type: "scenario";
  postal_code: string;
  room_type: RoomType;
  size_m2: number;
  building_year: number | null;
  horizon_years: number;
  own_numbers: Record<string, number>;
  assumptions: Record<string, number | string | boolean>;
  best_option: Option;
  end_wealth: Record<string, number>;
  updates: number;
}

/** False when the browser asks not to be tracked. */
export function trackingAllowed() {
  if (typeof navigator === "undefined") return false;
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack !== "1" && privacy.globalPrivacyControl !== true;
}

let visit: string | null = null;

/** A random number for this page load. It lives only in memory, so a new visit gets a new one. */
export function visitId() {
  visit ??= crypto.randomUUID();
  return visit;
}

/** Send an anonymous usage event without waiting for it. */
export function track(event: AreaEvent | ScenarioEvent) {
  if (!trackingAllowed()) return;
  const body = JSON.stringify({ ...event, visit: visitId() });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall back to fetch
  }
  fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
    () => undefined,
  );
}
