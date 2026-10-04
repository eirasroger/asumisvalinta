const LOCALE = "en-IE";

const euro = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroSigned = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const euroCents = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export const formatEuro = (value: number) => euro.format(value);
export const formatSignedEuro = (value: number) => euroSigned.format(value);
export const formatEuroCents = (value: number) => euroCents.format(value);
export const formatNumber = (value: number, digits = 1) =>
  digits === 1 ? number.format(value) : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(value);
export const formatPercent = (share: number, digits = 1) =>
  `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(share * 100)}%`;

export function formatCompactEuro(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}€${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(1)}k`;
  return `${sign}€${Math.round(abs)}`;
}

export function formatQuarter(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  return `${year} Q${Math.floor((month - 1) / 3) + 1}`;
}

export function formatPeriodLabel(label: string) {
  return label.replace(/^(\d{4})Q(\d)$/, "$1 Q$2");
}

/** Reads numbers typed as 1200, 1 200, 1,200, 1200.5 or 3,5. */
export function parseNumber(text: string): number | null {
  let cleaned = text.replace(/[\s€%]/g, "").replace(/−/g, "-");
  if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/,/g, "");
  else if (/,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
