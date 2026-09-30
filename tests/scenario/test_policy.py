import csv
import datetime as dt

import pytest

from asumisvalinta.config import REPO_ROOT
from asumisvalinta.scenario.policy import PolicyRow, resolve_policy


def _date(text: str) -> dt.date | None:
    return dt.date.fromisoformat(text) if text else None


@pytest.fixture(scope="module")
def rows() -> list[PolicyRow]:
    with open(REPO_ROOT / "dbt" / "seeds" / "policy_parameters.csv", encoding="utf-8") as file:
        return [
            PolicyRow(
                row["parameter_code"],
                float(row["value"]),
                _date(row["valid_from"]),
                _date(row["valid_to"]),
            )
            for row in csv.DictReader(file)
        ]


def test_current_rules(rows):
    policy = resolve_policy(rows, dt.date(2026, 9, 30))
    assert policy.transfer_tax_rate == 0.015
    assert policy.max_loan_to_collateral == 0.95
    assert policy.capital_income_tax_rate == 0.30
    assert policy.interest_tax_at_source_rate == 0.30
    assert policy.asp_interest_subsidy_threshold_rate == 0.038
    assert policy.asp_loan_max == 160_000


def test_higher_asp_loan_cap_in_major_cities(rows):
    assert resolve_policy(rows, dt.date(2026, 9, 30), asp_major_city=True).asp_loan_max == 230_000


def test_transfer_tax_before_october_2023(rows):
    assert resolve_policy(rows, dt.date(2023, 10, 11)).transfer_tax_rate == 0.02
    assert resolve_policy(rows, dt.date(2023, 10, 12)).transfer_tax_rate == 0.015


def test_first_time_buyer_exemption_ended_in_2024(rows):
    exempt = resolve_policy(rows, dt.date(2023, 12, 31), first_home=True, buyer_age=30)
    assert exempt.transfer_tax_rate == 0.0
    too_old = resolve_policy(rows, dt.date(2023, 12, 31), first_home=True, buyer_age=40)
    assert too_old.transfer_tax_rate == 0.015
    after = resolve_policy(rows, dt.date(2024, 1, 1), first_home=True, buyer_age=30)
    assert after.transfer_tax_rate == 0.015


def test_loan_cap_for_other_than_first_homes_rose_in_july_2026(rows):
    assert resolve_policy(rows, dt.date(2026, 6, 30)).max_loan_to_collateral == 0.90
    assert resolve_policy(rows, dt.date(2026, 7, 1)).max_loan_to_collateral == 0.95
    first_home = resolve_policy(rows, dt.date(2026, 6, 30), first_home=True)
    assert first_home.max_loan_to_collateral == 0.95
