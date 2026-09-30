"""Inputs and outputs of the scenario engine.

All money amounts are nominal euros. Rates and growth rates are annual decimals
(0.03 means 3 % per year) unless a field name says otherwise.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_YEARS = 30

Option = Literal["buy", "rent", "aso"]


class _Model(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class RatePath(_Model):
    """Annual interest rate path. The rate for a year applies to all its months."""

    kind: Literal["flat", "rising", "falling", "custom"] = "flat"
    start_rate: float = Field(ge=-0.05, le=0.30)
    change_per_year: float = Field(default=0.0, ge=0.0, le=0.05)
    custom_rates: tuple[float, ...] = ()
    floor: float = Field(default=0.0, ge=-0.05, le=0.30)

    @model_validator(mode="after")
    def _custom_rates_given(self) -> "RatePath":
        if self.kind == "custom" and not self.custom_rates:
            raise ValueError("custom rate path needs custom_rates")
        return self

    def rate_for_year(self, year_index: int) -> float:
        if self.kind == "flat":
            return self.start_rate
        if self.kind == "rising":
            return self.start_rate + self.change_per_year * year_index
        if self.kind == "falling":
            return max(self.floor, self.start_rate - self.change_per_year * year_index)
        return self.custom_rates[min(year_index, len(self.custom_rates) - 1)]


class MortgageInput(_Model):
    down_payment_share: float = Field(ge=0.0, le=1.0)
    term_years: int = Field(ge=1, le=40)
    repayment: Literal["annuity", "equal_principal"] = "annuity"
    rate_type: Literal["variable", "fixed"] = "variable"
    rate_path: RatePath
    fixed_rate: float | None = Field(default=None, ge=-0.05, le=0.30)
    fixed_years: int | None = Field(default=None, ge=1, le=40)

    @model_validator(mode="after")
    def _fixed_terms_given(self) -> "MortgageInput":
        if self.rate_type == "fixed" and (self.fixed_rate is None or self.fixed_years is None):
            raise ValueError("a fixed-rate mortgage needs fixed_rate and fixed_years")
        return self

    def rate_for_month(self, month: int) -> float:
        year = month // 12
        if self.rate_type == "fixed" and year < (self.fixed_years or 0):
            return self.fixed_rate or 0.0
        return self.rate_path.rate_for_year(year)


class BuyInput(_Model):
    price_per_m2: float = Field(gt=0)
    price_growth: float = Field(ge=-0.5, le=0.5)
    maintenance_charge_per_m2_month: float = Field(ge=0)
    maintenance_charge_growth: float = Field(ge=-0.5, le=0.5)
    renovation_reserve_per_m2_year: float = Field(default=0.0, ge=0)
    housing_company_loan_share: float = Field(default=0.0, ge=0)
    housing_company_loan_years: int = Field(default=20, ge=1, le=40)
    selling_cost_rate: float = Field(ge=0, le=0.2)
    mortgage: MortgageInput


class RentInput(_Model):
    rent_per_m2_month: float = Field(gt=0)
    rent_growth: float = Field(ge=-0.5, le=0.5)


class AsoInput(_Model):
    fee_per_m2: float = Field(ge=0)
    charge_per_m2_month: float = Field(gt=0)
    charge_growth: float = Field(ge=-0.5, le=0.5)
    building_cost_index_growth: float = Field(ge=-0.5, le=0.5)


class InvestmentInput(_Model):
    surplus_strategy: Literal["invest", "park"] = "invest"
    investment_return: float = Field(ge=-0.5, le=0.5)
    parked_cash_return: float = Field(ge=-0.5, le=0.5)
    tax_gains: bool = True

    @property
    def annual_return(self) -> float:
        if self.surplus_strategy == "invest":
            return self.investment_return
        return self.parked_cash_return


class PolicyInput(_Model):
    transfer_tax_rate: float = Field(ge=0, le=0.1)
    capital_income_tax_rate_lower: float = Field(ge=0, le=1)
    capital_income_tax_rate_upper: float = Field(ge=0, le=1)
    capital_income_tax_threshold: float = Field(ge=0)
    home_sale_exemption_min_years: int = Field(ge=0)
    presumptive_acquisition_cost_rate_short: float = Field(ge=0, le=1)
    presumptive_acquisition_cost_rate_long: float = Field(ge=0, le=1)
    presumptive_acquisition_cost_threshold_years: int = Field(ge=0)
    max_loan_to_collateral: float = Field(gt=0, le=1)


class ScenarioInput(_Model):
    size_m2: float = Field(gt=0, le=500)
    horizon_years: int = Field(ge=1, le=MAX_YEARS)
    buy: BuyInput
    rent: RentInput
    aso: AsoInput | None
    investment: InvestmentInput
    policy: PolicyInput

    @model_validator(mode="after")
    def _loan_share_fits_price(self) -> "ScenarioInput":
        if self.buy.housing_company_loan_share >= self.buy.price_per_m2 * self.size_m2:
            raise ValueError("the housing company loan share must be below the debt-free price")
        return self


class OptionResult(_Model):
    option: Option
    upfront_payment: float
    housing_costs: float
    total_paid: float
    end_wealth: float
    breakdown: dict[str, float]


class YearPoint(_Model):
    year: int
    wealth: dict[Option, float]
    total_paid: dict[Option, float]


class ScenarioResult(_Model):
    horizon_years: int
    initial_capital: float
    options: tuple[OptionResult, ...]
    years: tuple[YearPoint, ...]
    break_even_years_buy_vs_rent: int | None
    break_even_years_buy_vs_aso: int | None
    warnings: tuple[str, ...]

    def option(self, name: Option) -> OptionResult:
        return next(result for result in self.options if result.option == name)
