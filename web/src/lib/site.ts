export const SITE_URL = "https://asumisvalinta.fi";

export const CONTACT_EMAIL = "hei@asumisvalinta.fi";

export const PRIVACY_EMAIL = "tietosuoja@asumisvalinta.fi";

export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN ?? "").replace(/\/$/, "");

export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";

export const ADS_LIVE = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT);
