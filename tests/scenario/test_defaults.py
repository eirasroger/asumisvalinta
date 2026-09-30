"""Scenario defaults read from the CI fixture warehouse."""

import datetime as dt

import pytest

from asumisvalinta.scenario import simulate
from asumisvalinta.scenario.defaults import load_defaults
from tests.warehouse import WAREHOUSE, requires_warehouse

pytestmark = requires_warehouse


@pytest.fixture(scope="module")
def defaults():
    return load_defaults(
        "00100", "two_room", 50, purchase_date=dt.date(2026, 9, 30), warehouse=WAREHOUSE
    )


def test_market_levels_come_from_the_mart(defaults):
    scenario = defaults.scenario
    assert scenario.buy.price_per_m2 == 7167
    assert scenario.rent.rent_per_m2_month == pytest.approx(25.14)
    assert scenario.buy.maintenance_charge_per_m2_month == pytest.approx(5.90)


def test_mortgage_rate_is_the_latest_variable_rate(defaults):
    # ECB, variable rate on new housing loans in Finland, July 2026: 3.16 %.
    assert defaults.scenario.buy.mortgage.rate_path.start_rate == pytest.approx(0.0316)


def test_aso_defaults_follow_the_local_market(defaults):
    # Each sampled building's charge is divided by the market rent where it stands; the
    # median ratio times the rent of 00100 (25.14 €/m²) is the default charge here.
    sample = defaults.aso_sample
    assert 0.7 < sample.charge_to_rent < 1.0
    assert defaults.scenario.aso.charge_per_m2_month == pytest.approx(sample.charge_to_rent * 25.14)
    assert defaults.scenario.aso.fee_per_m2 == pytest.approx(sample.fee_to_price * 7167)


def test_rent_grows_with_inflation_but_at_least_two_percent(defaults):
    # Consumer price index 2015 = 100.0, 2025 = 122.7: 1.227 ** 0.1 - 1 = 2.07 % a year.
    assert defaults.scenario.rent.rent_growth == pytest.approx(1.227**0.1 - 1)


def test_savings_default_to_a_deposit_account_at_the_ecb_rate(defaults):
    # ECB, new household deposits up to one year in Finland, July 2026: 2.54 %.
    investment = defaults.scenario.investment
    assert investment.surplus_strategy == "park"
    assert investment.parked_cash_return == pytest.approx(0.0254)


def test_owners_pay_repairs_and_capital_charges(defaults):
    buy = defaults.scenario.buy
    # Owner-occupiers' own renovations in blocks of flats, 2021 to 2025:
    # (15.7 + 18.3 + 15.8 + 13.4 + 14.3) / 5 = 15.5 €/m² a year.
    assert buy.own_repairs_per_m2_year == pytest.approx(15.5)
    assert buy.capital_charges_per_m2_month[0] > 0


def test_building_year_adjusts_the_maintenance_charge():
    # 1980s buildings: 4.72 €/m² against 4.88 €/m² for all ages, applied to 5.90 €/m².
    older = load_defaults(
        "00100",
        "two_room",
        50,
        purchase_date=dt.date(2026, 9, 30),
        warehouse=WAREHOUSE,
        building_year=1985,
    )
    assert older.scenario.buy.maintenance_charge_per_m2_month == pytest.approx(5.90 * 4.72 / 4.88)
    # A 1985 building is 41 in 2026, like a 1984 building in 2025: 0.85 €/m² a month.
    assert older.scenario.buy.capital_charges_per_m2_month[0] == pytest.approx(0.85)


def test_asp_loan_cap_is_higher_in_helsinki(defaults):
    assert defaults.scenario.policy.asp_loan_max == 230_000


def test_every_default_has_a_source(defaults):
    assert "postal_code level" in defaults.sources["price_per_m2"]
    assert all(defaults.sources.values())


def test_defaults_run_through_the_engine(defaults):
    result = simulate(defaults.scenario)
    assert {option.option for option in result.options} == {"buy", "rent", "aso"}
