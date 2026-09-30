import pytest

from asumisvalinta.scenario import (
    AsoInput,
    BuyInput,
    InvestmentInput,
    MortgageInput,
    PolicyInput,
    RatePath,
    RentInput,
    ScenarioInput,
)


@pytest.fixture
def policy() -> PolicyInput:
    """Rules in force on 2026-09-30 (seed policy_parameters)."""
    return PolicyInput(
        transfer_tax_rate=0.015,
        capital_income_tax_rate_lower=0.30,
        capital_income_tax_rate_upper=0.34,
        capital_income_tax_threshold=30_000,
        home_sale_exemption_min_years=2,
        presumptive_acquisition_cost_rate_short=0.20,
        presumptive_acquisition_cost_rate_long=0.40,
        presumptive_acquisition_cost_threshold_years=10,
        max_loan_to_collateral=0.95,
    )


@pytest.fixture
def simple_scenario(policy: PolicyInput) -> ScenarioInput:
    """A 50 m² flat with no interest, no growth and no investment return.

    Buy: debt-free price 4 000 €/m² = 200 000 €, 10 % down payment 20 000 €,
    transfer tax 1.5 % = 3 000 €, mortgage 180 000 € at 0 % repaid in equal
    instalments over 10 years = 1 500 €/month, maintenance 5 €/m² = 250 €/month.
    Rent: 20 €/m² = 1 000 €/month. ASO: fee 400 €/m² = 20 000 €, charge
    15 €/m² = 750 €/month.
    """
    return ScenarioInput(
        size_m2=50,
        horizon_years=1,
        buy=BuyInput(
            price_per_m2=4_000,
            price_growth=0.0,
            maintenance_charge_per_m2_month=5,
            maintenance_charge_growth=0.0,
            renovation_reserve_per_m2_year=0,
            selling_cost_rate=0.04,
            mortgage=MortgageInput(
                down_payment_share=0.10,
                term_years=10,
                repayment="equal_principal",
                rate_path=RatePath(kind="flat", start_rate=0.0),
            ),
        ),
        rent=RentInput(rent_per_m2_month=20, rent_growth=0.0),
        aso=AsoInput(
            fee_per_m2=400,
            charge_per_m2_month=15,
            charge_growth=0.0,
            building_cost_index_growth=0.0,
        ),
        investment=InvestmentInput(investment_return=0.0, parked_cash_return=0.0),
        policy=policy,
    )
