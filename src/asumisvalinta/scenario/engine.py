"""Compare renting, right-of-occupancy (asumisoikeus) and buying over a horizon.

Every option starts with the same initial capital and spends the same amount each
month: the option with the highest housing cost that month sets the budget, and
the others put the difference into a portfolio. Wealth is measured as if
everything were turned into cash at the end of the horizon, after taxes.
See content/methodology.md for the formulas.
"""

from dataclasses import dataclass, field

from asumisvalinta.scenario.loans import Schedule, schedule
from asumisvalinta.scenario.models import (
    MAX_YEARS,
    Option,
    OptionResult,
    ScenarioInput,
    ScenarioResult,
    YearPoint,
)
from asumisvalinta.scenario.taxes import capital_income_tax, taxable_home_gain

MONTHS = MAX_YEARS * 12


@dataclass
class _Portfolio:
    value: float
    contributions: float
    monthly_return: float

    def step(self, contribution: float) -> None:
        self.value = self.value * (1 + self.monthly_return) + contribution
        self.contributions += contribution

    @property
    def gain(self) -> float:
        return max(self.value - self.contributions, 0.0)


@dataclass
class _Track:
    upfront: float
    portfolio: _Portfolio
    housing_costs: float = 0.0
    wealth_by_year: dict[int, float] = field(default_factory=dict)
    paid_by_year: dict[int, float] = field(default_factory=dict)
    breakdown_by_year: dict[int, dict[str, float]] = field(default_factory=dict)


def _grown(amount: float, growth: float, years: float) -> float:
    return amount * (1 + growth) ** years


def _monthly(annual: float) -> float:
    return (1 + annual) ** (1 / 12) - 1


def simulate(scenario: ScenarioInput) -> ScenarioResult:
    buy, rent, aso, policy = scenario.buy, scenario.rent, scenario.aso, scenario.policy
    size = scenario.size_m2
    warnings: list[str] = []

    debt_free_price = buy.price_per_m2 * size
    share_price = debt_free_price - buy.housing_company_loan_share
    down_payment = buy.mortgage.down_payment_share * debt_free_price
    if down_payment > share_price:
        raise ValueError("the down payment exceeds the price paid for the shares")
    mortgage_principal = share_price - down_payment
    transfer_tax = policy.transfer_tax_rate * debt_free_price
    if mortgage_principal / debt_free_price > policy.max_loan_to_collateral + 1e-9:
        warnings.append(
            f"The mortgage is {mortgage_principal / debt_free_price:.0%} of the debt-free price, "
            f"above the {policy.max_loan_to_collateral:.0%} loan cap."
        )
    if buy.renovation_reserve_per_m2_year == 0:
        warnings.append("Major renovations are not included; add a renovation reserve if needed.")

    mortgage = schedule(
        mortgage_principal,
        buy.mortgage.term_years * 12,
        buy.mortgage.rate_for_month,
        MONTHS,
        buy.mortgage.repayment,
    )
    company_loan = schedule(
        buy.housing_company_loan_share,
        buy.housing_company_loan_years * 12,
        lambda month: buy.mortgage.rate_path.rate_for_year(month // 12),
        MONTHS,
        "annuity",
    )

    aso_fee = aso.fee_per_m2 * size if aso else 0.0
    buy_upfront = down_payment + transfer_tax
    initial_capital = max(buy_upfront, aso_fee)
    monthly_return = _monthly(scenario.investment.annual_return)

    tracks: dict[Option, _Track] = {
        "buy": _Track(buy_upfront, _Portfolio(initial_capital - buy_upfront, 0.0, monthly_return)),
        "rent": _Track(0.0, _Portfolio(initial_capital, 0.0, monthly_return)),
    }
    tracks["buy"].portfolio.contributions = tracks["buy"].portfolio.value
    tracks["rent"].portfolio.contributions = initial_capital
    if aso:
        start = initial_capital - aso_fee
        tracks["aso"] = _Track(aso_fee, _Portfolio(start, start, monthly_return))

    for month in range(MONTHS):
        year = month // 12
        charge_growth = buy.maintenance_charge_growth
        maintenance = _grown(buy.maintenance_charge_per_m2_month, charge_growth, year)
        renovation = _grown(buy.renovation_reserve_per_m2_year, charge_growth, year)
        outflows: dict[Option, float] = {
            "buy": mortgage.payment[month]
            + company_loan.payment[month]
            + (maintenance + renovation / 12) * size,
            "rent": _grown(rent.rent_per_m2_month, rent.rent_growth, year) * size,
        }
        if aso:
            outflows["aso"] = _grown(aso.charge_per_m2_month, aso.charge_growth, year) * size
        budget = max(outflows.values())
        for option, track in tracks.items():
            track.housing_costs += outflows[option]
            track.portfolio.step(budget - outflows[option])

        months_elapsed = month + 1
        if months_elapsed % 12 == 0:
            _record_year(scenario, tracks, months_elapsed, mortgage, company_loan, aso_fee)

    horizon = scenario.horizon_years
    options = tuple(
        OptionResult(
            option=option,
            upfront_payment=track.upfront,
            housing_costs=track.paid_by_year[horizon] - track.upfront,
            total_paid=track.paid_by_year[horizon],
            end_wealth=track.wealth_by_year[horizon],
            breakdown=track.breakdown_by_year[horizon],
        )
        for option, track in tracks.items()
    )
    years = tuple(
        YearPoint(
            year=year,
            wealth={option: track.wealth_by_year[year] for option, track in tracks.items()},
            total_paid={option: track.paid_by_year[year] for option, track in tracks.items()},
        )
        for year in range(1, MAX_YEARS + 1)
    )
    return ScenarioResult(
        horizon_years=horizon,
        initial_capital=initial_capital,
        options=options,
        years=years,
        break_even_years_buy_vs_rent=_break_even(tracks["buy"], tracks["rent"]),
        break_even_years_buy_vs_aso=_break_even(tracks["buy"], tracks["aso"]) if aso else None,
        warnings=tuple(warnings),
    )


def _record_year(
    scenario: ScenarioInput,
    tracks: dict[Option, _Track],
    months: int,
    mortgage: Schedule,
    company_loan: Schedule,
    aso_fee: float,
) -> None:
    buy, policy, invest = scenario.buy, scenario.policy, scenario.investment
    year = months // 12

    def portfolio_gain(track: _Track) -> float:
        return track.portfolio.gain if invest.tax_gains else 0.0

    track = tracks["buy"]
    debt_free_price = buy.price_per_m2 * scenario.size_m2
    home_value = _grown(debt_free_price, buy.price_growth, months / 12)
    selling_costs = buy.selling_cost_rate * home_value
    mortgage_left = mortgage.balance[months - 1]
    company_loan_left = company_loan.balance[months - 1]
    home_gain = taxable_home_gain(
        home_value,
        debt_free_price + policy.transfer_tax_rate * debt_free_price,
        selling_costs,
        months,
        policy,
    )
    tax = capital_income_tax(home_gain + portfolio_gain(track), policy)
    track.wealth_by_year[year] = (
        home_value - selling_costs - mortgage_left - company_loan_left + track.portfolio.value - tax
    )
    track.paid_by_year[year] = track.upfront + track.housing_costs
    track.breakdown_by_year[year] = {
        "home_value": home_value,
        "selling_costs": selling_costs,
        "mortgage_left": mortgage_left,
        "housing_company_loan_left": company_loan_left,
        "portfolio_value": track.portfolio.value,
        "tax": tax,
    }

    track = tracks["rent"]
    tax = capital_income_tax(portfolio_gain(track), policy)
    track.wealth_by_year[year] = track.portfolio.value - tax
    track.paid_by_year[year] = track.upfront + track.housing_costs
    track.breakdown_by_year[year] = {"portfolio_value": track.portfolio.value, "tax": tax}

    if "aso" in tracks and scenario.aso:
        track = tracks["aso"]
        index_ratio = (1 + scenario.aso.building_cost_index_growth) ** (months / 12)
        refund = aso_fee * max(1.0, index_ratio)
        exempt = months >= policy.home_sale_exemption_min_years * 12
        refund_gain = 0.0 if exempt else refund - aso_fee
        tax = capital_income_tax(refund_gain + portfolio_gain(track), policy)
        track.wealth_by_year[year] = refund + track.portfolio.value - tax
        track.paid_by_year[year] = track.upfront + track.housing_costs
        track.breakdown_by_year[year] = {
            "fee_refund": refund,
            "portfolio_value": track.portfolio.value,
            "tax": tax,
        }


def _break_even(first: _Track, second: _Track) -> int | None:
    """First whole year in which the first option ends with at least as much wealth."""
    for year in range(1, MAX_YEARS + 1):
        if first.wealth_by_year[year] >= second.wealth_by_year[year]:
            return year
    return None
