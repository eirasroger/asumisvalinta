import pytest

from asumisvalinta.scenario.loans import annuity_payment, schedule
from asumisvalinta.scenario.models import RatePath


def test_annuity_payment_matches_the_standard_formula():
    # 200 000 € at 3 % for 25 years: i = 0.0025, n = 300,
    # payment = 200 000 * 0.0025 / (1 - 1.0025 ** -300) = 948.42 €.
    assert annuity_payment(200_000, 0.03 / 12, 300) == pytest.approx(948.42, abs=0.01)


def test_annuity_at_zero_interest_splits_the_balance_evenly():
    assert annuity_payment(12_000, 0.0, 12) == pytest.approx(1_000)


def test_annuity_schedule_repays_the_loan_within_its_term():
    loan = schedule(200_000, 300, lambda month: 0.03, months=360)
    assert loan.payment[0] == pytest.approx(948.42, abs=0.01)
    assert loan.interest[0] == pytest.approx(500.00)
    assert loan.balance[299] == pytest.approx(0.0, abs=1e-6)
    assert loan.payment[300] == 0.0


def test_annuity_payment_is_recalculated_when_the_rate_changes():
    # 100 000 € over 20 years; 2 % in year one, 4 % from year two.
    loan = schedule(100_000, 240, lambda month: 0.02 if month < 12 else 0.04, months=240)
    expected_second_year = annuity_payment(loan.balance[11], 0.04 / 12, 228)
    assert loan.payment[11] == pytest.approx(annuity_payment(100_000, 0.02 / 12, 240))
    assert loan.payment[12] == pytest.approx(expected_second_year)
    assert loan.balance[239] == pytest.approx(0.0, abs=1e-6)


def test_equal_principal_schedule():
    # 120 000 € over 10 years at 6 %: principal 1 000 €/month, first interest 600 €.
    loan = schedule(120_000, 120, lambda month: 0.06, months=120, repayment="equal_principal")
    assert loan.principal[0] == pytest.approx(1_000)
    assert loan.payment[0] == pytest.approx(1_600)
    assert loan.balance[11] == pytest.approx(108_000)
    assert loan.payment[1] == pytest.approx(1_000 + 119_000 * 0.005)


def test_rate_paths():
    assert RatePath(kind="flat", start_rate=0.03).rate_for_year(5) == 0.03
    rising = RatePath(kind="rising", start_rate=0.03, change_per_year=0.005)
    assert rising.rate_for_year(2) == pytest.approx(0.04)
    falling = RatePath(kind="falling", start_rate=0.01, change_per_year=0.005)
    assert falling.rate_for_year(1) == pytest.approx(0.005)
    assert falling.rate_for_year(5) == 0.0
    custom = RatePath(kind="custom", start_rate=0.03, custom_rates=(0.03, 0.025))
    assert custom.rate_for_year(0) == 0.03
    assert custom.rate_for_year(10) == 0.025
