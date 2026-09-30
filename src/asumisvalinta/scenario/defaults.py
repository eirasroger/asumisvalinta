"""Default scenario inputs for a postal code and room type, read from the warehouse.

Every default carries a note on where it comes from, so the app can show which
values are statistics and which are assumptions.
"""

import datetime as dt
import statistics
from dataclasses import dataclass
from pathlib import Path

import duckdb

from asumisvalinta.config import duckdb_path
from asumisvalinta.scenario.models import (
    AsoInput,
    BuyInput,
    InvestmentInput,
    MortgageInput,
    RatePath,
    RentInput,
    ScenarioInput,
)
from asumisvalinta.scenario.policy import PolicyRow, resolve_policy

GROWTH_YEARS = 10


@dataclass(frozen=True)
class Defaults:
    scenario: ScenarioInput
    sources: dict[str, str]


class DefaultsError(LookupError):
    pass


def _cagr(start: float, end: float, years: int) -> float:
    return (end / start) ** (1 / years) - 1


def load_defaults(
    postal_code: str,
    room_type: str,
    size_m2: float,
    horizon_years: int = 5,
    purchase_date: dt.date | None = None,
    first_home: bool = False,
    buyer_age: int | None = None,
    warehouse: Path | None = None,
) -> Defaults:
    purchase_date = purchase_date or dt.date.today()
    with duckdb.connect(str(warehouse or duckdb_path()), read_only=True) as connection:

        def one(sql: str, params: list | None = None) -> tuple:
            row = connection.execute(sql, params or []).fetchone()
            if row is None:
                raise DefaultsError(f"No data for: {sql.split(chr(10))[0]}")
            return row

        (
            municipality_code,
            price_per_m2,
            price_level,
            price_period,
            rent_per_m2,
            rent_level,
            rent_period,
            maintenance_charge,
            charge_area,
            price_growth,
            rent_growth,
        ) = one(
            """
            select municipality_code, price_per_m2, price_geography_level, price_period_label,
                rent_per_m2, rent_geography_level, rent_period_label,
                maintenance_charge_per_m2, maintenance_charge_area_code,
                coalesce(price_cagr_10y, price_cagr_5y), coalesce(rent_cagr_10y, rent_cagr_5y)
            from marts.mart_market_levels
            where postal_code = ? and room_type = ?
            """,
            [postal_code, room_type],
        )

        variable_rate, rate_month = one(
            """
            select new_mortgage_rate_variable_pct / 100, month_start_date
            from marts.fct_interest_rates
            where new_mortgage_rate_variable_pct is not null
            order by month_start_date desc
            limit 1
            """
        )

        charge_end, charge_start, charge_end_year = one(
            f"""
            select latest.value_eur_per_m2_month, earlier.value_eur_per_m2_month,
                latest.period_label
            from marts.fct_housing_company_charges as latest
            inner join marts.fct_housing_company_charges as earlier
                on earlier.area_code = latest.area_code
                and earlier.account_item_code = latest.account_item_code
                and earlier.building_type = latest.building_type
                and extract(year from earlier.period_start_date)
                    = extract(year from latest.period_start_date) - {GROWTH_YEARS}
            where latest.area_code = ? and latest.account_item_code = 'k3001'
                and latest.building_type = 'block_of_flats'
            order by latest.period_start_date desc
            limit 1
            """,
            [charge_area],
        )

        index_end, index_start, index_month = one(
            f"""
            select latest.index_value, earlier.index_value, latest.month_start_date
            from marts.fct_building_cost_index as latest
            inner join marts.fct_building_cost_index as earlier
                on earlier.base_year = latest.base_year
                and earlier.month_start_date = latest.month_start_date
                    - interval {GROWTH_YEARS} year
            where latest.base_year = 2015 and not latest.is_preliminary
            order by latest.month_start_date desc
            limit 1
            """
        )

        offers = connection.execute(
            """
            select municipality, right_of_occupancy_fee_avg_eur_per_m2, monthly_charge_eur_per_m2
            from seeds.aso_offers as offers
            inner join marts.dim_postal_area as postal on offers.postal_code = postal.postal_code
            where postal.municipality_code = ?
            """,
            [municipality_code],
        ).fetchall()
        aso_scope = "municipality"
        if not offers:
            offers = connection.execute(
                "select municipality, right_of_occupancy_fee_avg_eur_per_m2, "
                "monthly_charge_eur_per_m2 from seeds.aso_offers"
            ).fetchall()
            aso_scope = "all sampled cities"

        assumptions = dict(
            connection.execute("select parameter_code, value from seeds.assumptions").fetchall()
        )
        policy_rows = [
            PolicyRow(*row)
            for row in connection.execute(
                "select parameter_code, value, valid_from, valid_to from seeds.policy_parameters"
            ).fetchall()
        ]

    policy = resolve_policy(policy_rows, purchase_date, first_home, buyer_age)
    maintenance_growth = _cagr(charge_start, charge_end, GROWTH_YEARS)
    index_growth = _cagr(index_start, index_end, GROWTH_YEARS)
    fee_per_m2 = statistics.median(offer[1] for offer in offers)
    aso_charge = statistics.median(offer[2] for offer in offers)

    scenario = ScenarioInput(
        size_m2=size_m2,
        horizon_years=horizon_years,
        buy=BuyInput(
            price_per_m2=price_per_m2,
            price_growth=price_growth,
            maintenance_charge_per_m2_month=maintenance_charge,
            maintenance_charge_growth=maintenance_growth,
            renovation_reserve_per_m2_year=assumptions["renovation_reserve_eur_per_m2_year"],
            selling_cost_rate=assumptions["selling_cost_rate"],
            mortgage=MortgageInput(
                down_payment_share=assumptions["down_payment_share"],
                term_years=int(assumptions["loan_term_years"]),
                rate_path=RatePath(kind="flat", start_rate=variable_rate),
            ),
        ),
        rent=RentInput(rent_per_m2_month=rent_per_m2, rent_growth=rent_growth),
        aso=AsoInput(
            fee_per_m2=fee_per_m2,
            charge_per_m2_month=aso_charge,
            charge_growth=maintenance_growth,
            building_cost_index_growth=index_growth,
        ),
        investment=InvestmentInput(
            investment_return=assumptions["investment_return_rate"],
            parked_cash_return=assumptions["parked_cash_return_rate"],
        ),
        policy=policy,
    )
    sources = {
        "price_per_m2": f"Statistics Finland, {price_level} level, {price_period}",
        "rent_per_m2_month": (
            f"Statistics Finland, non-subsidised, {rent_level} level, {rent_period}"
        ),
        "price_growth": f"Price index, compound annual growth over {GROWTH_YEARS} years",
        "rent_growth": f"Rent index, compound annual growth over {GROWTH_YEARS} years",
        "maintenance_charge": f"Housing company finances, area {charge_area}, {charge_end_year}",
        "maintenance_charge_growth": f"Housing company finances, {GROWTH_YEARS}-year growth",
        "mortgage_rate": f"ECB, variable rate on new housing loans in Finland, {rate_month:%Y-%m}",
        "aso_fee_and_charge": f"Median of sampled Asuntosäätiö buildings ({aso_scope})",
        "aso_charge_growth": "Assumed equal to maintenance charge growth",
        "building_cost_index_growth": f"Building cost index, {GROWTH_YEARS}-year growth "
        f"to {index_month:%Y-%m}",
        "policy": f"Tax and lending rules valid on {purchase_date:%Y-%m-%d}",
        "assumptions": "Calculator assumptions (editable)",
    }
    return Defaults(scenario=scenario, sources=sources)
