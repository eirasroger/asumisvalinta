"""Finnish capital income tax rules used by the scenario engine."""

from asumisvalinta.scenario.models import PolicyInput


def capital_income_tax(taxable_income: float, policy: PolicyInput) -> float:
    """Progressive capital income tax on income realised in one tax year."""
    if taxable_income <= 0:
        return 0.0
    lower_part = min(taxable_income, policy.capital_income_tax_threshold)
    upper_part = max(taxable_income - policy.capital_income_tax_threshold, 0.0)
    return (
        lower_part * policy.capital_income_tax_rate_lower
        + upper_part * policy.capital_income_tax_rate_upper
    )


def is_home_sale_exempt(months_owned: int, policy: PolicyInput) -> bool:
    """Own home sale is tax-free after the minimum ownership and residence period.

    The owner is assumed to live in the home for the whole ownership period.
    """
    return months_owned >= policy.home_sale_exemption_min_years * 12


def taxable_home_gain(
    sale_price: float,
    acquisition_cost: float,
    selling_costs: float,
    months_owned: int,
    policy: PolicyInput,
) -> float:
    """Taxable gain on selling a home, using whichever acquisition cost favours the seller."""
    if is_home_sale_exempt(months_owned, policy):
        return 0.0
    actual_gain = sale_price - acquisition_cost - selling_costs
    presumptive_rate = (
        policy.presumptive_acquisition_cost_rate_long
        if months_owned >= policy.presumptive_acquisition_cost_threshold_years * 12
        else policy.presumptive_acquisition_cost_rate_short
    )
    presumptive_gain = sale_price * (1 - presumptive_rate)
    return max(0.0, min(actual_gain, presumptive_gain))
