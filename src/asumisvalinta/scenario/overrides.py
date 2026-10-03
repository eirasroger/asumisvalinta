"""Apply user overrides to default scenario inputs."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from asumisvalinta.scenario.models import RatePath, ScenarioInput


class ScenarioOverrides(BaseModel):
    """Inputs a user can change. Rates and growth rates are annual decimals."""

    model_config = ConfigDict(extra="forbid")

    price_per_m2: float | None = Field(default=None, gt=0)
    rent_per_m2_month: float | None = Field(default=None, gt=0)
    price_growth: float | None = None
    rent_growth: float | None = None
    interest_rate: float | None = None
    rate_path: Literal["flat", "rising", "falling"] | None = None
    rate_change_per_year: float | None = Field(default=None, ge=0)
    down_payment_share: float | None = Field(default=None, ge=0, le=1)
    loan_term_years: int | None = Field(default=None, ge=1, le=40)
    repayment: Literal["annuity", "equal_principal"] | None = None
    maintenance_charge_per_m2_month: float | None = Field(default=None, ge=0)
    own_repairs_per_m2_year: float | None = Field(default=None, ge=0)
    aso_fee_per_m2: float | None = Field(default=None, ge=0)
    aso_charge_per_m2_month: float | None = Field(default=None, gt=0)
    investment_return: float | None = None
    surplus_strategy: Literal["invest", "park", "keep"] | None = None


def _update(model: BaseModel, **changes: Any) -> Any:
    changes = {key: value for key, value in changes.items() if value is not None}
    return model.model_copy(update=changes) if changes else model


def apply_overrides(scenario: ScenarioInput, overrides: ScenarioOverrides) -> ScenarioInput:
    buy, mortgage = scenario.buy, scenario.buy.mortgage
    path = mortgage.rate_path
    if overrides.interest_rate is not None or overrides.rate_path or overrides.rate_change_per_year:
        path = RatePath(
            kind=overrides.rate_path or path.kind,
            start_rate=overrides.interest_rate
            if overrides.interest_rate is not None
            else path.start_rate,
            change_per_year=overrides.rate_change_per_year
            if overrides.rate_change_per_year is not None
            else path.change_per_year,
        )
    fixed = mortgage.rate_type == "fixed"
    fixed_for_whole_term = fixed and mortgage.fixed_years == mortgage.term_years
    mortgage = _update(
        mortgage,
        rate_path=path,
        fixed_rate=overrides.interest_rate if fixed else None,
        fixed_years=overrides.loan_term_years if fixed_for_whole_term else None,
        down_payment_share=overrides.down_payment_share,
        term_years=overrides.loan_term_years,
        repayment=overrides.repayment,
    )
    buy = _update(
        buy,
        mortgage=mortgage,
        price_per_m2=overrides.price_per_m2,
        price_growth=overrides.price_growth,
        maintenance_charge_per_m2_month=overrides.maintenance_charge_per_m2_month,
        own_repairs_per_m2_year=overrides.own_repairs_per_m2_year,
    )
    rent = _update(
        scenario.rent,
        rent_per_m2_month=overrides.rent_per_m2_month,
        rent_growth=overrides.rent_growth,
    )
    aso = scenario.aso
    if aso is not None:
        aso = _update(
            aso,
            fee_per_m2=overrides.aso_fee_per_m2,
            charge_per_m2_month=overrides.aso_charge_per_m2_month,
        )
    investment = _update(
        scenario.investment,
        investment_return=overrides.investment_return,
        surplus_strategy=overrides.surplus_strategy,
    )
    return ScenarioInput.model_validate(
        {
            **scenario.model_dump(),
            "buy": buy.model_dump(),
            "rent": rent.model_dump(),
            "aso": aso.model_dump() if aso else None,
            "investment": investment.model_dump(),
        }
    )
