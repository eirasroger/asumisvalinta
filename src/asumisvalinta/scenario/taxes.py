"""Finnish capital income tax rules used by the scenario engine."""

from asumisvalinta.scenario.models import PolicyInput


def capital_income_tax(taxable_income: float, policy: PolicyInput) -> float:
    """Capital income tax at the flat lower rate."""
    return max(taxable_income, 0.0) * policy.capital_income_tax_rate


def after_tax_interest_rate(annual_rate: float, policy: PolicyInput) -> float:
    """Deposit interest net of the tax withheld at source when it is paid."""
    return annual_rate * (1 - policy.interest_tax_at_source_rate)


def is_home_sale_exempt(months_owned: int, policy: PolicyInput) -> bool:
    """Own home sale is tax-free after the minimum ownership and residence period.

    The owner is assumed to live in the home for the whole ownership period.
    """
    return months_owned >= policy.home_sale_exemption_min_years * 12


def _gain(sale_price: float, actual_gain: float, presumptive_rate: float) -> float:
    """Taxable gain with whichever acquisition cost favours the seller."""
    return max(0.0, min(actual_gain, sale_price * (1 - presumptive_rate)))


def _held_long(months_owned: int, policy: PolicyInput) -> bool:
    return months_owned >= policy.presumptive_acquisition_cost_threshold_years * 12


def taxable_home_gain(
    sale_price: float,
    acquisition_cost: float,
    selling_costs: float,
    months_owned: int,
    policy: PolicyInput,
) -> float:
    """Taxable gain on selling a home."""
    if is_home_sale_exempt(months_owned, policy):
        return 0.0
    rate = (
        policy.presumptive_acquisition_cost_rate_long
        if _held_long(months_owned, policy)
        else policy.presumptive_acquisition_cost_rate_short
    )
    return _gain(sale_price, sale_price - acquisition_cost - selling_costs, rate)


def taxable_securities_gain(
    sale_price: float, acquisition_cost: float, months_owned: int, policy: PolicyInput
) -> float:
    """Taxable gain on selling fund units bought over `months_owned` months."""
    rate = (
        policy.presumptive_acquisition_cost_rate_securities_long
        if _held_long(months_owned, policy)
        else policy.presumptive_acquisition_cost_rate_securities_short
    )
    return _gain(sale_price, sale_price - acquisition_cost, rate)
