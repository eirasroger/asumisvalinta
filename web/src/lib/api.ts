import { trackingAllowed } from "@/lib/analytics";

export type RoomType = "one_room" | "two_room" | "three_room_plus";
export type Option = "buy" | "rent" | "aso";

export const ROOM_TYPES: { value: RoomType; label: string; short: string; flats: string }[] = [
  { value: "one_room", label: "Studio (yksiö)", short: "Studio", flats: "studios" },
  { value: "two_room", label: "1 bedroom (kaksio)", short: "1 bedroom", flats: "one-bedroom flats" },
  { value: "three_room_plus", label: "2+ bedrooms (kolmio+)", short: "2+ bedrooms", flats: "flats with two or more bedrooms" },
];

export const ROOM_NOTE =
  "Finnish listings count rooms without the kitchen: a yksiö is a studio, a kaksio has one bedroom and a living room, and a kolmio or larger has two or more bedrooms. Statistics Finland publishes these three groups only.";

export const OPTION_LABELS: Record<Option, string> = {
  buy: "Buy",
  rent: "Rent",
  aso: "Right of occupancy",
};

export const OPTION_COLORS: Record<Option, string> = {
  buy: "var(--series-buy)",
  rent: "var(--series-rent)",
  aso: "var(--series-aso)",
};

export interface PostalArea {
  postal_code: string;
  postal_area_name: string;
  municipality_name: string;
  is_helsinki_metro: boolean;
}

export interface MarketLevel {
  room_type: RoomType;
  price_per_m2: number;
  price_geography_level: string;
  price_geography_code: string;
  price_period_label: string;
  price_is_preliminary: boolean;
  rent_per_m2: number;
  rent_basis: string;
  rent_geography_level: string;
  rent_geography_code: string;
  rent_period_label: string;
  maintenance_charge_per_m2: number;
  price_cagr_10y: number | null;
  rent_cagr_10y: number | null;
  price_to_rent_ratio: number | null;
  gross_rental_yield: number | null;
}

export interface Market {
  postal_area: PostalArea & { region_name: string };
  levels: MarketLevel[];
}

export type SeriesPoint = { period: string } & Record<string, number | null | string>;

export interface MarketHistory {
  prices: SeriesPoint[];
  rents: SeriesPoint[];
  rents_2015_series: SeriesPoint[];
  rent_area: { code: string; level: string };
}

export interface RatePath {
  kind: "flat" | "rising" | "falling" | "custom";
  start_rate: number;
  change_per_year: number;
  custom_rates: number[];
  floor: number;
}

export interface ScenarioInput {
  size_m2: number;
  horizon_years: number;
  buy: {
    price_per_m2: number;
    price_growth: number;
    maintenance_charge_per_m2_month: number;
    maintenance_charge_growth: number;
    capital_charges_per_m2_month: number[];
    own_repairs_per_m2_year: number;
    housing_company_loan_share: number;
    housing_company_loan_years: number;
    selling_cost_rate: number;
    mortgage: {
      down_payment_share: number;
      term_years: number;
      repayment: "annuity" | "equal_principal";
      rate_type: "variable" | "fixed";
      rate_path: RatePath;
      fixed_rate: number | null;
      fixed_years: number | null;
      asp_loan: boolean;
    };
  };
  rent: { rent_per_m2_month: number; rent_growth: number };
  aso: {
    fee_per_m2: number;
    charge_per_m2_month: number;
    charge_growth: number;
    building_cost_index_growth: number;
  } | null;
  investment: {
    surplus_strategy: "invest" | "park" | "keep";
    investment_return: number;
    parked_cash_return: number;
    tax_gains: boolean;
  };
  policy: Record<string, number>;
}

export interface Range {
  lower_quartile: number | null;
  median: number;
  upper_quartile: number | null;
  area?: string;
  period?: string;
}

export interface PlannerStart {
  scenario: ScenarioInput;
  sources: Record<string, string>;
  rent_growth: { market: number; lease_clause: number };
  market: {
    postal_code: string;
    postal_area_name: string;
    municipality_name: string;
    price: {
      per_m2: number;
      level: string;
      period: string;
      preliminary: boolean;
      range_per_m2: Range | null;
    };
    rent: {
      per_m2: number;
      level: string;
      period: string;
      basis: string;
      range_monthly: Range | null;
    };
    maintenance_charge_per_m2: number;
    aso: {
      scope: string;
      buildings: number;
      fee_per_m2: Range;
      charge_per_m2: Range;
      charge_to_rent: number;
      fee_to_price: number;
    };
  };
}

export interface OptionResult {
  option: Option;
  upfront_payment: number;
  housing_costs: number;
  total_paid: number;
  end_wealth: number;
  breakdown: Record<string, number>;
}

export interface ScenarioResult {
  horizon_years: number;
  initial_capital: number;
  options: OptionResult[];
  years: { year: number; wealth: Partial<Record<Option, number>>; total_paid: Partial<Record<Option, number>> }[];
  break_even_years_buy_vs_rent: number | null;
  break_even_years_buy_vs_aso: number | null;
  warnings: string[];
}

export interface WhatIf {
  key: string;
  label: string;
  end_wealth: Partial<Record<Option, number>>;
  break_even_years_buy_vs_rent: number | null;
}

export interface PlannerRun {
  result: ScenarioResult;
  monthly_costs: ({ year: number } & Partial<Record<Option, number>>)[];
  what_ifs: WhatIf[];
}

export interface MapValue {
  postal_code: string;
  postal_area_name: string;
  municipality_code: string;
  municipality_name: string;
  price_per_m2: number | null;
  price_geography_level: string | null;
  rent_per_m2: number | null;
  rent_geography_level: string | null;
  price_to_rent_ratio: number | null;
}

export interface AskResponse {
  status: "answered" | "refused" | "needs_clarification" | "error";
  answer: string;
  value: number | null;
  unit: string | null;
  sources: string;
  tools_used: string[];
  remaining_questions: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : validationMessage(body.detail);
    } catch {
      // keep the status text
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

function validationMessage(detail: unknown) {
  if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === "string") {
    return detail[0].msg.replace(/^Value error, /, "");
  }
  return JSON.stringify(detail);
}

export const api = {
  searchPostalAreas: (q: string) =>
    request<PostalArea[]>(`/api/postal-areas?q=${encodeURIComponent(q)}`),
  market: (postalCode: string) => request<Market>(`/api/market/${postalCode}`),
  marketHistory: (postalCode: string, roomType: RoomType) =>
    request<MarketHistory>(`/api/market/${postalCode}/history?room_type=${roomType}`),
  rates: () => request<SeriesPoint[]>("/api/rates"),
  plannerStart: (
    params: { postal_code: string; room_type: RoomType; size_m2: number; building_year?: number | null },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      postal_code: params.postal_code,
      room_type: params.room_type,
      size_m2: String(params.size_m2),
    });
    if (params.building_year) query.set("building_year", String(params.building_year));
    return request<PlannerStart>(`/api/planner/start?${query}`, { signal });
  },
  plannerRun: (scenario: ScenarioInput, signal?: AbortSignal) =>
    request<PlannerRun>("/api/planner/run", {
      method: "POST",
      body: JSON.stringify(scenario),
      signal,
    }),
  mapValues: (roomType: RoomType) => request<MapValue[]>(`/api/map/values?room_type=${roomType}`),
  ask: (question: string, sessionId: string) =>
    request<AskResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId, record: trackingAllowed() }),
    }),
};
