"""Compare renting, right-of-occupancy (asumisoikeus) and buying over a horizon.

Every option starts with the same initial capital and spends the same amount each
month: the option with the highest housing cost that month sets the budget, and
the others save the difference. Savings earn deposit interest taxed at source, or
an investment return taxed when the fund units are sold. Wealth is measured as if
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
from asumisvalinta.scenario.taxes import (
    after_tax_interest_rate,
    capital_income_tax,
    taxable_home_gain,
    taxable_securities_gain,
)

MONTHS = MAX_YEARS * 12


@dataclass
class _Portfolio:
    value: float
    contributions: float
    monthly_return: float

    def step(self, contribution: float) -> None:
        self.value = self.value * (1 + self.monthly_return) + contribution
        self.contributions += contribution


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
    if buy.mortgage.asp_loan and buy.mortgage.down_payment_share < policy.asp_min_savings_share:
        warnings.append(
            f"An ASP loan needs savings of at least {policy.asp_min_savings_share:.0%} "
            "of the price."
        )

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
    invest = scenario.investment
    net_return = {
        "invest": invest.investment_return,
        "park": after_tax_interest_rate(invest.parked_cash_return, policy),
        "keep": 0.0,
    }[invest.surplus_strategy]
    monthly_return = _monthly(net_return)
    asp_share = (
        min(1.0, policy.asp_loan_max / mortgage_principal)
        if buy.mortgage.asp_loan and mortgage_principal > 0
        else 0.0
    )

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
        capital_charge = _grown(
            _for_year(buy.capital_charges_per_m2_month, year), charge_growth, year
        )
        repairs = _grown(buy.own_repairs_per_m2_year, charge_growth, year)
        subsidy = _asp_subsidy(scenario, mortgage, mortgage_principal, asp_share, month)
        outflows: dict[Option, float] = {
            "buy": mortgage.payment[month]
            + company_loan.payment[month]
            + (maintenance + capital_charge + repairs / 12) * size
            - subsidy,
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


def _for_year(values: tuple[float, ...], year: int) -> float:
    if not values:
        return 0.0
    return values[min(year, len(values) - 1)]


def _asp_subsidy(
    scenario: ScenarioInput, mortgage: Schedule, principal: float, asp_share: float, month: int
) -> float:
    """State interest subsidy on the ASP part of the mortgage for one month."""
    policy = scenario.policy
    if asp_share == 0 or month >= policy.asp_interest_subsidy_max_years * 12:
        return 0.0
    balance = principal if month == 0 else mortgage.balance[month - 1]
    excess = max(
        0.0,
        scenario.buy.mortgage.rate_for_month(month) - policy.asp_interest_subsidy_threshold_rate,
    )
    return policy.asp_interest_subsidy_share * excess * balance * asp_share / 12


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
        if not invest.tax_gains or invest.surplus_strategy != "invest":
            return 0.0
        portfolio = track.portfolio
        return taxable_securities_gain(portfolio.value, portfolio.contributions, months, policy)

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
