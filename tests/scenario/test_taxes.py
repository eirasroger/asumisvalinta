import pytest

from asumisvalinta.scenario.taxes import (
    after_tax_interest_rate,
    capital_income_tax,
    taxable_home_gain,
    taxable_securities_gain,
)


def test_capital_income_tax_is_flat(policy):
    assert capital_income_tax(10_000, policy) == pytest.approx(3_000)
    assert capital_income_tax(40_000, policy) == pytest.approx(12_000)


def test_no_tax_on_losses(policy):
    assert capital_income_tax(-5_000, policy) == 0.0


def test_deposit_interest_is_net_of_tax_at_source(policy):
    # 2.5 % interest, 30 % withheld: 1.75 % is left.
    assert after_tax_interest_rate(0.025, policy) == pytest.approx(0.0175)


def test_home_sale_is_exempt_after_two_years(policy):
    assert taxable_home_gain(300_000, 200_000, 10_000, 24, policy) == 0.0


def test_short_ownership_uses_actual_costs_when_they_give_the_lower_gain(policy):
    # Sold after 12 months for 240 000 €: actual gain 240 000 - 203 000 - 9 600 = 27 400 €;
    # presumptive gain 240 000 * (1 - 20 %) = 192 000 €. The lower one is taxed.
    assert taxable_home_gain(240_000, 203_000, 9_600, 12, policy) == pytest.approx(27_400)


def test_presumptive_cost_applies_when_it_favours_the_seller(policy):
    # Sold for 100 000 €. Presumptive gain: 100 000 * (1 - 20 %) = 80 000 €.
    # Acquisition 20 000 € + selling costs 1 000 €: actual gain 79 000 € is lower, so it is used.
    assert taxable_home_gain(100_000, 20_000, 1_000, 12, policy) == pytest.approx(79_000)
    # Acquisition 1 000 €: actual gain 99 000 €, so the presumptive 80 000 € is used.
    assert taxable_home_gain(100_000, 1_000, 0, 12, policy) == pytest.approx(80_000)


def test_fund_gain_uses_the_presumptive_cost_when_it_is_lower(policy):
    # Units bought for 10 000 € sold for 60 000 € after 5 years: actual gain 50 000 €,
    # presumptive gain 60 000 * (1 - 20 %) = 48 000 €.
    assert taxable_securities_gain(60_000, 10_000, 60, policy) == pytest.approx(48_000)
    # After 10 years the presumptive cost is 40 %: 60 000 * 0.6 = 36 000 €.
    assert taxable_securities_gain(60_000, 10_000, 120, policy) == pytest.approx(36_000)
    # A small gain is taxed as it is.
    assert taxable_securities_gain(11_000, 10_000, 60, policy) == pytest.approx(1_000)
