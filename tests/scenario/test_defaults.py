"""Scenario defaults read from the CI fixture warehouse."""

import datetime as dt

import pytest

from asumisvalinta.config import connect_read_only
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


def test_mortgage_is_fixed_for_the_whole_term_with_a_fifth_down(defaults):
    mortgage = defaults.scenario.buy.mortgage
    assert mortgage.rate_type == "fixed"
    assert mortgage.fixed_rate == mortgage.rate_path.start_rate
    assert mortgage.term_years == mortgage.fixed_years == 25
    assert mortgage.down_payment_share == 0.20


def test_aso_defaults_follow_the_local_market(defaults):
    # Each sampled building's charge is divided by the market rent where it stands; the
    # median ratio times the rent of 00100 (25.14 €/m²) is the default charge here.
    sample = defaults.aso_sample
    assert 0.7 < sample.charge_to_rent < 1.0
    assert defaults.scenario.aso.charge_per_m2_month == pytest.approx(sample.charge_to_rent * 25.14)
    assert defaults.scenario.aso.fee_per_m2 == pytest.approx(sample.fee_to_price * 7167)


def test_market_rent_growth_is_offered(defaults):
    with connect_read_only(WAREHOUSE) as connection:
        market = connection.execute(
            "select rent_cagr_10y from marts.mart_market_levels "
            "where postal_code = '00100' and room_type = 'two_room'"
        ).fetchone()[0]
    assert defaults.rent_growth_market == pytest.approx(market)


def test_lease_clause_follows_inflation_but_at_least_two_percent(defaults):
    # Consumer price index 2015 = 100.0, 2025 = 122.7: 1.227 ** 0.1 - 1 = 2.07 % a year.
    assert defaults.rent_growth_lease_clause == pytest.approx(1.227**0.1 - 1)
    assert defaults.scenario.rent.rent_growth == defaults.rent_growth_lease_clause


def test_aso_charges_grow_like_the_varke_series(defaults):
    # Whole-country changes 2019 to 2025: 0.6, 1.2, 0.6, 0.9, 3.8, 5.7 and 3.8 %.
    changes = [0.006, 0.012, 0.006, 0.009, 0.038, 0.057, 0.038]
    product = 1.0
    for change in changes:
        product *= 1 + change
    assert defaults.scenario.aso.charge_growth == pytest.approx(product ** (1 / 7) - 1)


def test_housing_company_charges_grow_like_aso_charges(defaults):
    buy = defaults.scenario.buy
    assert buy.maintenance_charge_growth == defaults.scenario.aso.charge_growth
    assert "grew" in defaults.sources["maintenance_charge_growth"]


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


def test_building_year_scales_the_price_by_sales_of_its_decade():
    # Flats built from 2010 on in 00100, 2017 to 2021: each year's price of the decade divided
    # by the price of all flats there, averaged with the decade's sales as weights.
    with connect_read_only(WAREHOUSE) as connection:
        rows = connection.execute(
            """
            select decade.price_per_m2 / total.price_per_m2, decade.transaction_count
            from raw_statfin.prices_postal_by_construction_yearly_2010 as decade
            inner join raw_statfin.prices_postal_by_construction_yearly_2010 as total
                on decade.postal_code = total.postal_code and decade.period = total.period
            where decade.postal_code = '00100' and decade.construction_period = '8'
                and total.construction_period = '0' and decade.period >= '2017'
            """
        ).fetchall()
    ratio = sum(r * n for r, n in rows) / sum(n for _, n in rows)
    newer = load_defaults(
        "00100",
        "two_room",
        50,
        purchase_date=dt.date(2026, 9, 30),
        warehouse=WAREHOUSE,
        building_year=2015,
    )
    assert newer.price_age_ratio == pytest.approx(ratio)
    assert newer.scenario.buy.price_per_m2 == pytest.approx(7167 * ratio)
    assert "this postal code" in newer.sources["price_building_age"]


def test_aso_fee_follows_the_price_for_all_building_ages(defaults):
    newer = load_defaults(
        "00100",
        "two_room",
        50,
        purchase_date=dt.date(2026, 9, 30),
        warehouse=WAREHOUSE,
        building_year=2015,
    )
    assert newer.scenario.aso.fee_per_m2 == pytest.approx(newer.aso_sample.fee_to_price * 7167)


def test_asp_loan_cap_is_higher_in_helsinki(defaults):
    assert defaults.scenario.policy.asp_loan_max == 230_000


def test_every_default_has_a_source(defaults):
    assert "postal_code level" in defaults.sources["price_per_m2"]
    assert all(defaults.sources.values())


def test_defaults_run_through_the_engine(defaults):
    result = simulate(defaults.scenario)
    assert {option.option for option in result.options} == {"buy", "rent", "aso"}


def test_fee_refund_grows_by_the_cautious_assumption(defaults):
    assert defaults.scenario.aso.building_cost_index_growth == 0.01
    assert "Assumption" in defaults.sources["building_cost_index_growth"]
