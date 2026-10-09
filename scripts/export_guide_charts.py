"""Write the worked examples drawn in the guides as JSON, computed with the scenario engine."""

import json
from pathlib import Path

from asumisvalinta.config import REPO_ROOT
from asumisvalinta.scenario.loans import annuity_payment, schedule

OUTPUT = REPO_ROOT / "web" / "src" / "lib" / "guideCharts.json"

LOAN = 250_000
TERMS_YEARS = (25, 40)
RATES = [round(0.5 + 0.25 * step, 2) for step in range(23)]

DEBT_FREE_PRICE = 250_000
LOAN_SHARES = {"A": 20_000, "B": 100_000}
COMPANY_RATE = 3.5
COMPANY_TERM_YEARS = 25


def payment_by_rate() -> dict:
    def payments(years: int) -> list[int]:
        return [round(annuity_payment(LOAN, rate / 100 / 12, years * 12)) for rate in RATES]

    terms = {str(years): payments(years) for years in TERMS_YEARS}
    return {"loan": LOAN, "rates": RATES, "terms": terms}


def company_loan() -> dict:
    months = COMPANY_TERM_YEARS * 12
    flats = []
    for name, share in LOAN_SHARES.items():
        plan = schedule(share, months, lambda _: COMPANY_RATE / 100, months)
        flats.append(
            {
                "name": name,
                "selling_price": DEBT_FREE_PRICE - share,
                "loan_share": share,
                "monthly_charge": round(plan.payment[0]),
                "interest": int(round(sum(plan.interest), -3)),
            }
        )
    return {"rate": COMPANY_RATE, "years": COMPANY_TERM_YEARS, "flats": flats}


def main() -> None:
    data = {"payment_by_rate": payment_by_rate(), "company_loan": company_loan()}
    Path(OUTPUT).write_text(json.dumps(data, indent=2) + "\n", "utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
