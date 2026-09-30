"""Monthly repayment schedules for mortgages and housing company loans."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Schedule:
    """Per-month payment, interest and principal, and the balance after each month."""

    payment: tuple[float, ...]
    interest: tuple[float, ...]
    principal: tuple[float, ...]
    balance: tuple[float, ...]


def annuity_payment(balance: float, monthly_rate: float, months_left: int) -> float:
    """Level payment that repays `balance` in `months_left` months at `monthly_rate`."""
    if months_left <= 0:
        return balance
    if monthly_rate == 0:
        return balance / months_left
    return balance * monthly_rate / (1 - (1 + monthly_rate) ** -months_left)


def schedule(
    principal: float,
    term_months: int,
    annual_rate_for_month: Callable[[int], float],
    months: int,
    repayment: Literal["annuity", "equal_principal"] = "annuity",
) -> Schedule:
    """Repayment schedule over `months` months.

    The monthly rate is the annual rate divided by 12. An annuity payment is
    recalculated whenever the rate changes, so the loan term stays fixed.
    """
    payments, interests, principals, balances = [], [], [], []
    balance = principal
    payment = 0.0
    previous_rate: float | None = None
    level_principal = principal / term_months if term_months else 0.0
    for month in range(months):
        if month >= term_months or balance <= 1e-9:
            payments.append(0.0)
            interests.append(0.0)
            principals.append(0.0)
            balances.append(0.0)
            balance = 0.0
            continue
        monthly_rate = annual_rate_for_month(month) / 12
        interest = balance * monthly_rate
        if repayment == "annuity":
            if previous_rate is None or monthly_rate != previous_rate:
                payment = annuity_payment(balance, monthly_rate, term_months - month)
            repaid = payment - interest
        else:
            repaid = level_principal
        repaid = min(repaid, balance)
        balance -= repaid
        payments.append(repaid + interest)
        interests.append(interest)
        principals.append(repaid)
        balances.append(balance)
        previous_rate = monthly_rate
    return Schedule(tuple(payments), tuple(interests), tuple(principals), tuple(balances))
