const euro = new Intl.NumberFormat("en-FI", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const euroCents = new Intl.NumberFormat("en-FI", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("en-FI", { maximumFractionDigits: 1 });

export const formatEuro = (value: number) => euro.format(value);
export const formatEuroCents = (value: number) => euroCents.format(value);
export const formatNumber = (value: number) => number.format(value);
export const formatPercent = (share: number, digits = 1) => `${(share * 100).toFixed(digits)} %`;

export function formatCompactEuro(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${Math.round(value)} €`;
}

export function formatQuarter(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  return `${year} Q${Math.floor((month - 1) / 3) + 1}`;
}

const LEVEL_LABELS: Record<string, string> = {
  postal_code: "Postal code",
  price_sub_area: "Price sub-area",
  rent_sub_area: "Rent sub-area",
  municipality: "Municipality",
  municipality_all_rooms: "Municipality, all room types",
  region: "Region",
  country: "Whole country",
};

export const formatLevel = (level: string) => LEVEL_LABELS[level] ?? level;
