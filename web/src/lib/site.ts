export const SITE_URL = "https://asumisvalinta.fi";

export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN ?? "").replace(/\/$/, "");

export const ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN ?? "";
