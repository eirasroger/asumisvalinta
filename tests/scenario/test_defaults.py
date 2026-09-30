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


def test_aso_defaults_are_medians_of_the_municipality_sample(defaults):
    # Twelve sampled Helsinki buildings: middle fees 577.40 and 591.79 €/m²,
    # middle charges 17.56 and 18.38 €/m²/month.
    aso = defaults.scenario.aso
    assert aso.fee_per_m2 == pytest.approx((577.40 + 591.79) / 2)
    assert aso.charge_per_m2_month == pytest.approx((17.56 + 18.38) / 2)


def test_every_default_has_a_source(defaults):
    assert "postal_code level" in defaults.sources["price_per_m2"]
    assert all(defaults.sources.values())


def test_defaults_run_through_the_engine(defaults):
    result = simulate(defaults.scenario)
    assert {option.option for option in result.options} == {"buy", "rent", "aso"}
