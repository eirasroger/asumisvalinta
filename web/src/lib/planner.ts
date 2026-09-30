import type { PlannerStart, RoomType, ScenarioInput } from "@/lib/api";

export interface Flat {
  postal_code: string;
  room_type: RoomType;
  size_m2: number;
  building_year: number | null;
  horizon_years: number;
}

/** The user's own numbers, in euros. A null field means the market value is used. */
export interface Offer {
  rent: number | null;
  price: number | null;
  company_loan: number | null;
  maintenance: number | null;
  capital_charges: number | null;
  own_repairs: number | null;
  aso_fee: number | null;
  aso_charge: number | null;
}

export const MARKET_OFFER: Offer = {
  rent: null,
  price: null,
  company_loan: null,
  maintenance: null,
  capital_charges: null,
  own_repairs: null,
  aso_fee: null,
  aso_charge: null,
};

export interface Assumptions {
  include_aso: boolean;
  asp_loan?: boolean;
  down_payment_share?: number;
  rate_type?: "variable" | "fixed";
  start_rate?: number;
  rate_kind?: "flat" | "rising" | "falling";
  change_per_year?: number;
  fixed_rate?: number;
  fixed_years?: number;
  term_years?: number;
  repayment?: "annuity" | "equal_principal";
  price_growth?: number;
  rent_growth?: number;
  charge_growth?: number;
  aso_charge_growth?: number;
  selling_cost_rate?: number;
  surplus_strategy?: "invest" | "park";
  investment_return?: number;
  parked_cash_return?: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = { include_aso: true };

export type Typical = Record<keyof Offer, number>;

/** Market values for the flat, converted from per-m² figures to euro amounts. */
export function typicalValues(start: PlannerStart, size: number): Typical {
  const { buy, rent, aso } = start.scenario;
  return {
    rent: rent.rent_per_m2_month * size,
    price: buy.price_per_m2 * size,
    company_loan: buy.housing_company_loan_share,
    maintenance: buy.maintenance_charge_per_m2_month * size,
    capital_charges: (buy.capital_charges_per_m2_month[0] ?? 0) * size,
    own_repairs: buy.own_repairs_per_m2_year * size,
    aso_fee: (aso?.fee_per_m2 ?? start.market.aso.fee_per_m2.median) * size,
    aso_charge: (aso?.charge_per_m2_month ?? start.market.aso.charge_per_m2.median) * size,
  };
}

export function offerValue(offer: Offer, typical: Typical, key: keyof Offer) {
  return offer[key] ?? typical[key];
}

export function buildScenario(start: PlannerStart, flat: Flat, offer: Offer, assumptions: Assumptions): ScenarioInput {
  const base = start.scenario;
  const size = flat.size_m2;
  const typical = typicalValues(start, size);
  const value = (key: keyof Offer) => offerValue(offer, typical, key);
  const mortgage = base.buy.mortgage;
  const rateType = assumptions.rate_type ?? mortgage.rate_type;
  const startRate = assumptions.start_rate ?? mortgage.rate_path.start_rate;

  return {
    ...base,
    size_m2: size,
    horizon_years: flat.horizon_years,
    buy: {
      ...base.buy,
      price_per_m2: value("price") / size,
      maintenance_charge_per_m2_month: value("maintenance") / size,
      capital_charges_per_m2_month: scaledSchedule(base.buy.capital_charges_per_m2_month, typical.capital_charges, value("capital_charges"), size),
      own_repairs_per_m2_year: value("own_repairs") / size,
      housing_company_loan_share: value("company_loan"),
      price_growth: assumptions.price_growth ?? base.buy.price_growth,
      maintenance_charge_growth: assumptions.charge_growth ?? base.buy.maintenance_charge_growth,
      selling_cost_rate: assumptions.selling_cost_rate ?? base.buy.selling_cost_rate,
      mortgage: {
        ...mortgage,
        down_payment_share: assumptions.down_payment_share ?? mortgage.down_payment_share,
        term_years: assumptions.term_years ?? mortgage.term_years,
        repayment: assumptions.repayment ?? mortgage.repayment,
        rate_type: rateType,
        rate_path: {
          ...mortgage.rate_path,
          kind: assumptions.rate_kind ?? (mortgage.rate_path.kind === "custom" ? "flat" : mortgage.rate_path.kind),
          start_rate: startRate,
          change_per_year: assumptions.change_per_year ?? (mortgage.rate_path.change_per_year || 0.0025),
          custom_rates: [],
        },
        fixed_rate: rateType === "fixed" ? (assumptions.fixed_rate ?? mortgage.fixed_rate ?? startRate) : null,
        fixed_years: rateType === "fixed" ? (assumptions.fixed_years ?? mortgage.fixed_years ?? 5) : null,
        asp_loan: assumptions.asp_loan ?? false,
      },
    },
    rent: {
      rent_per_m2_month: value("rent") / size,
      rent_growth: assumptions.rent_growth ?? base.rent.rent_growth,
    },
    aso:
      assumptions.include_aso && base.aso
        ? {
            ...base.aso,
            fee_per_m2: value("aso_fee") / size,
            charge_per_m2_month: value("aso_charge") / size,
            charge_growth: assumptions.aso_charge_growth ?? base.aso.charge_growth,
          }
        : null,
    investment: {
      ...base.investment,
      surplus_strategy: assumptions.surplus_strategy ?? base.investment.surplus_strategy,
      investment_return: assumptions.investment_return ?? base.investment.investment_return,
      parked_cash_return: assumptions.parked_cash_return ?? base.investment.parked_cash_return,
    },
  };
}

/** The renovation charge rises as the building ages; a user's figure scales the whole path. */
function scaledSchedule(schedule: number[], typical: number, chosen: number, size: number) {
  if (typical > 0 && schedule.length > 0) return schedule.map((value) => (value * chosen) / typical);
  return [chosen / size];
}

const ROOM_VALUES: RoomType[] = ["one_room", "two_room", "three_room_plus"];

export function flatFromParams(params: URLSearchParams): Flat {
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value >= min && value <= max && params.get(key) !== null ? value : fallback;
  };
  const postal = params.get("postal") ?? "";
  const rooms = params.get("rooms") as RoomType;
  const year = number("year", 0, 1800, 2035);
  return {
    postal_code: /^\d{5}$/.test(postal) ? postal : "00100",
    room_type: ROOM_VALUES.includes(rooms) ? rooms : "two_room",
    size_m2: number("size", 55, 10, 300),
    building_year: year || null,
    horizon_years: number("years", 5, 1, 30),
  };
}

export function flatToParams(flat: Flat) {
  const params = new URLSearchParams({
    postal: flat.postal_code,
    rooms: flat.room_type,
    size: String(flat.size_m2),
    years: String(flat.horizon_years),
  });
  if (flat.building_year) params.set("year", String(flat.building_year));
  return params.toString();
}
