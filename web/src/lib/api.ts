export type RoomType = "one_room" | "two_room" | "three_room_plus";
export type Option = "buy" | "rent" | "aso";

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: "one_room", label: "One room (yksiö)" },
  { value: "two_room", label: "Two rooms (kaksio)" },
  { value: "three_room_plus", label: "Three rooms or more (kolmio+)" },
];

export const OPTION_LABELS: Record<Option, string> = {
  buy: "Buy",
  rent: "Rent",
  aso: "Right of occupancy",
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

export interface Overrides {
  price_per_m2?: number;
  rent_per_m2_month?: number;
  price_growth?: number;
  rent_growth?: number;
  interest_rate?: number;
  rate_path?: "flat" | "rising" | "falling";
  rate_change_per_year?: number;
  down_payment_share?: number;
  loan_term_years?: number;
  repayment?: "annuity" | "equal_principal";
  maintenance_charge_per_m2_month?: number;
  renovation_reserve_per_m2_year?: number;
  aso_fee_per_m2?: number;
  aso_charge_per_m2_month?: number;
  investment_return?: number;
  surplus_strategy?: "invest" | "park";
}

export interface ScenarioRequest {
  postal_code: string;
  room_type: RoomType;
  size_m2: number;
  horizon_years: number;
  overrides: Overrides;
}

export interface OptionResult {
  option: Option;
  upfront_payment: number;
  housing_costs: number;
  total_paid: number;
  end_wealth: number;
  breakdown: Record<string, number>;
}

export interface ScenarioResponse {
  inputs: {
    size_m2: number;
    horizon_years: number;
    buy: {
      price_per_m2: number;
      price_growth: number;
      maintenance_charge_per_m2_month: number;
      renovation_reserve_per_m2_year: number;
      selling_cost_rate: number;
      mortgage: {
        down_payment_share: number;
        term_years: number;
        repayment: "annuity" | "equal_principal";
        rate_path: { kind: "flat" | "rising" | "falling" | "custom"; start_rate: number; change_per_year: number };
      };
    };
    rent: { rent_per_m2_month: number; rent_growth: number };
    aso: { fee_per_m2: number; charge_per_m2_month: number } | null;
    investment: { investment_return: number; surplus_strategy: "invest" | "park" };
  };
  sources: Record<string, string>;
  result: {
    horizon_years: number;
    initial_capital: number;
    options: OptionResult[];
    years: { year: number; wealth: Partial<Record<Option, number>>; total_paid: Partial<Record<Option, number>> }[];
    break_even_years_buy_vs_rent: number | null;
    break_even_years_buy_vs_aso: number | null;
    warnings: string[];
  };
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
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // keep the status text
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  searchPostalAreas: (q: string) =>
    request<PostalArea[]>(`/api/postal-areas?q=${encodeURIComponent(q)}`),
  market: (postalCode: string) => request<Market>(`/api/market/${postalCode}`),
  marketHistory: (postalCode: string, roomType: RoomType) =>
    request<MarketHistory>(`/api/market/${postalCode}/history?room_type=${roomType}`),
  rates: () => request<SeriesPoint[]>("/api/rates"),
  metrics: () => request<{ name: string; label: string; description: string }[]>("/api/metrics"),
  scenario: (body: ScenarioRequest) =>
    request<ScenarioResponse>("/api/scenario", { method: "POST", body: JSON.stringify(body) }),
  ask: (question: string, sessionId: string) =>
    request<AskResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId }),
    }),
};
