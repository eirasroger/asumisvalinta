import pytest

from asumisvalinta.scenario.taxes import capital_income_tax, taxable_home_gain


def test_capital_income_tax_below_threshold(policy):
    assert capital_income_tax(10_000, policy) == pytest.approx(3_000)


def test_capital_income_tax_above_threshold(policy):
    # 30 000 * 30 % + 10 000 * 34 % = 9 000 + 3 400
    assert capital_income_tax(40_000, policy) == pytest.approx(12_400)


def test_no_tax_on_losses(policy):
    assert capital_income_tax(-5_000, policy) == 0.0


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
