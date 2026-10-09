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
