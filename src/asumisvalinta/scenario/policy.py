"""Resolve tax and lending rules valid on a given date from the policy_parameters seed."""

import datetime as dt
from collections.abc import Iterable
from dataclasses import dataclass

from asumisvalinta.scenario.models import PolicyInput


@dataclass(frozen=True)
class PolicyRow:
    parameter_code: str
    value: float
    valid_from: dt.date | None
    valid_to: dt.date | None

    def valid_on(self, day: dt.date) -> bool:
        return (self.valid_from is None or self.valid_from <= day) and (
            self.valid_to is None or day <= self.valid_to
        )


def _value(rows: Iterable[PolicyRow], code: str, day: dt.date) -> float:
    matches = [row.value for row in rows if row.parameter_code == code and row.valid_on(day)]
    if len(matches) != 1:
        raise LookupError(f"{len(matches)} values of {code} are valid on {day}")
    return matches[0]


def _optional_value(rows: Iterable[PolicyRow], code: str, day: dt.date) -> float | None:
    try:
        return _value(rows, code, day)
    except LookupError:
        return None


def resolve_policy(
    rows: list[PolicyRow],
    purchase_date: dt.date,
    first_home: bool = False,
    buyer_age: int | None = None,
    asp_major_city: bool = False,
) -> PolicyInput:
    """Rules for a purchase signed on `purchase_date`.

    Capital income is taxed at the lower rate only; see content/methodology.md.
    """
    transfer_tax_rate = _value(rows, "transfer_tax_rate_housing_shares", purchase_date)
    if first_home and _value(rows, "first_time_buyer_transfer_tax_exempt", purchase_date) == 1:
        min_age = _optional_value(rows, "first_time_buyer_min_age", purchase_date)
        max_age = _optional_value(rows, "first_time_buyer_max_age", purchase_date)
        known = buyer_age is not None and min_age is not None and max_age is not None
        if known and min_age <= buyer_age <= max_age:
            transfer_tax_rate = 0.0
    loan_cap_code = (
        "max_loan_to_collateral_first_home" if first_home else "max_loan_to_collateral_other"
    )
    return PolicyInput(
        transfer_tax_rate=transfer_tax_rate,
        capital_income_tax_rate=_value(rows, "capital_income_tax_rate_lower", purchase_date),
        interest_tax_at_source_rate=_value(rows, "interest_tax_at_source_rate", purchase_date),
        home_sale_exemption_min_years=int(
            _value(rows, "home_sale_exemption_min_ownership_years", purchase_date)
        ),
        presumptive_acquisition_cost_rate_short=_value(
            rows, "presumptive_acquisition_cost_rate_short", purchase_date
        ),
        presumptive_acquisition_cost_rate_long=_value(
            rows, "presumptive_acquisition_cost_rate_long", purchase_date
        ),
        presumptive_acquisition_cost_threshold_years=int(
            _value(rows, "presumptive_acquisition_cost_threshold_years", purchase_date)
        ),
        presumptive_acquisition_cost_rate_securities_short=_value(
            rows, "presumptive_acquisition_cost_rate_securities_short", purchase_date
        ),
        presumptive_acquisition_cost_rate_securities_long=_value(
            rows, "presumptive_acquisition_cost_rate_securities_long", purchase_date
        ),
        max_loan_to_collateral=_value(rows, loan_cap_code, purchase_date),
        asp_interest_subsidy_threshold_rate=_value(
            rows, "asp_interest_subsidy_threshold_rate", purchase_date
        ),
        asp_interest_subsidy_share=_value(rows, "asp_interest_subsidy_share", purchase_date),
        asp_interest_subsidy_max_years=int(
            _value(rows, "asp_interest_subsidy_max_years", purchase_date)
        ),
        asp_min_savings_share=_value(rows, "asp_min_savings_share", purchase_date),
        asp_loan_max=_value(
            rows,
            "asp_loan_max_major_city" if asp_major_city else "asp_loan_max_other",
            purchase_date,
        ),
    )
