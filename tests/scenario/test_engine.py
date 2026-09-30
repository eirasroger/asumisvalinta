import pytest
from pydantic import ValidationError

from asumisvalinta.scenario import MortgageInput, RatePath, simulate


def test_initial_capital_is_the_larger_upfront_payment(simple_scenario):
    # Buyer: 20 000 € down payment + 3 000 € transfer tax; ASO fee 20 000 €.
    assert simulate(simple_scenario).initial_capital == pytest.approx(23_000)


def test_one_year_wealth_by_hand(simple_scenario):
    # Monthly budget = the highest outflow = buyer's 1 500 + 250 = 1 750 €.
    # Rent: 23 000 + 12 * (1 750 - 1 000) = 32 000 €.
    # ASO: (23 000 - 20 000) + 12 * (1 750 - 750) + refund 20 000 = 35 000 €.
    # Buy: home 200 000 - selling costs 8 000 - mortgage left 162 000 = 30 000 €;
    #      the sale within two years makes a loss, so no tax.
    result = simulate(simple_scenario)
    assert result.option("rent").end_wealth == pytest.approx(32_000)
    assert result.option("aso").end_wealth == pytest.approx(35_000)
    assert result.option("buy").end_wealth == pytest.approx(30_000)


def test_total_paid_by_hand(simple_scenario):
    result = simulate(simple_scenario)
    assert result.option("rent").total_paid == pytest.approx(12_000)
    assert result.option("aso").total_paid == pytest.approx(20_000 + 9_000)
    assert result.option("buy").total_paid == pytest.approx(23_000 + 21_000)


def test_break_even_by_hand(simple_scenario):
    # Buying loses 11 000 € up front (transfer tax + selling costs) and saves
    # 9 000 € a year against renting (3 000 € maintenance vs 12 000 € rent):
    # year 1: -2 000 €, year 2: +7 000 €.
    assert simulate(simple_scenario).break_even_years_buy_vs_rent == 2


def test_portfolio_gain_is_taxed_at_liquidation(simple_scenario):
    # Rent option with the whole 23 000 € invested at 12 % a year and the same
    # rent as the budget (no monthly surplus): gain 2 760 €, tax 30 % = 828 €.
    scenario = simple_scenario.model_copy(
        update={
            "aso": None,
            "rent": simple_scenario.rent.model_copy(update={"rent_per_m2_month": 35}),
            "investment": simple_scenario.investment.model_copy(update={"investment_return": 0.12}),
        }
    )
    rent = simulate(scenario).option("rent")
    assert rent.breakdown["portfolio_value"] == pytest.approx(23_000 * 1.12)
    assert rent.breakdown["tax"] == pytest.approx(2_760 * 0.30)
    assert rent.end_wealth == pytest.approx(23_000 * 1.12 - 828)


def test_parked_cash_uses_the_parked_return(simple_scenario):
    scenario = simple_scenario.model_copy(
        update={
            "aso": None,
            "rent": simple_scenario.rent.model_copy(update={"rent_per_m2_month": 35}),
            "investment": simple_scenario.investment.model_copy(
                update={
                    "surplus_strategy": "park",
                    "investment_return": 0.12,
                    "parked_cash_return": 0.01,
                    "tax_gains": False,
                }
            ),
        }
    )
    assert simulate(scenario).option("rent").end_wealth == pytest.approx(23_000 * 1.01)


def test_aso_refund_is_indexed_and_tax_free_after_two_years(simple_scenario):
    # 20 000 € fee indexed with 3 % a year for 3 years = 20 000 * 1.03 ** 3.
    scenario = simple_scenario.model_copy(
        update={
            "horizon_years": 3,
            "aso": simple_scenario.aso.model_copy(update={"building_cost_index_growth": 0.03}),
        }
    )
    aso = simulate(scenario).option("aso")
    assert aso.breakdown["fee_refund"] == pytest.approx(20_000 * 1.03**3)
    assert aso.breakdown["tax"] == 0.0


def test_aso_refund_never_falls_below_the_fee(simple_scenario):
    scenario = simple_scenario.model_copy(
        update={
            "aso": simple_scenario.aso.model_copy(update={"building_cost_index_growth": -0.05}),
        }
    )
    assert simulate(scenario).option("aso").breakdown["fee_refund"] == pytest.approx(20_000)


def test_home_sale_gain_within_two_years_is_taxed(simple_scenario):
    # Price growth 20 %: sold after one year for 240 000 €, selling costs 9 600 €.
    # Taxable gain 240 000 - 203 000 - 9 600 = 27 400 €, tax 30 % = 8 220 €.
    scenario = simple_scenario.model_copy(
        update={"buy": simple_scenario.buy.model_copy(update={"price_growth": 0.20})}
    )
    buy = simulate(scenario).option("buy")
    assert buy.breakdown["tax"] == pytest.approx(8_220)
    assert buy.end_wealth == pytest.approx(240_000 - 9_600 - 162_000 - 8_220)


def test_housing_company_loan_share_adds_a_financing_charge(simple_scenario):
    # 30 000 € of the debt-free price is the flat's share of the company loan, repaid at 0 %
    # over 10 years = 250 €/month. The buyer borrows 30 000 € less.
    scenario = simple_scenario.model_copy(
        update={
            "buy": simple_scenario.buy.model_copy(
                update={"housing_company_loan_share": 30_000, "housing_company_loan_years": 10}
            )
        }
    )
    buy = simulate(scenario).option("buy")
    assert buy.breakdown["housing_company_loan_left"] == pytest.approx(27_000)
    # Mortgage 150 000 € over 10 years = 1 250 €/month; 12 months repaid.
    assert buy.breakdown["mortgage_left"] == pytest.approx(135_000)


def test_loan_above_the_cap_is_flagged(simple_scenario):
    scenario = simple_scenario.model_copy(
        update={
            "buy": simple_scenario.buy.model_copy(
                update={
                    "mortgage": simple_scenario.buy.mortgage.model_copy(
                        update={"down_payment_share": 0.02}
                    )
                }
            )
        }
    )
    assert any("loan cap" in warning for warning in simulate(scenario).warnings)


def test_fixed_rate_switches_to_the_path_after_the_fixed_period():
    mortgage = MortgageInput(
        down_payment_share=0.1,
        term_years=25,
        rate_type="fixed",
        fixed_rate=0.035,
        fixed_years=5,
        rate_path=RatePath(kind="flat", start_rate=0.03),
    )
    assert mortgage.rate_for_month(59) == 0.035
    assert mortgage.rate_for_month(60) == 0.03


def test_fixed_rate_needs_its_terms():
    with pytest.raises(ValidationError):
        MortgageInput(
            down_payment_share=0.1,
            term_years=25,
            rate_type="fixed",
            rate_path=RatePath(kind="flat", start_rate=0.03),
        )


def test_results_cover_every_year_up_to_thirty(simple_scenario):
    result = simulate(simple_scenario)
    assert [point.year for point in result.years] == list(range(1, 31))
    assert result.years[0].wealth["rent"] == pytest.approx(32_000)
