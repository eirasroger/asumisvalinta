"""Default scenario inputs for a postal code and room type, read from the warehouse.

Every default carries a note on where it comes from, so the app can show which
values are statistics and which are assumptions.
"""

import datetime as dt
import statistics
from dataclasses import dataclass
from pathlib import Path

from asumisvalinta.config import connect_read_only
from asumisvalinta.scenario.models import (
    MAX_YEARS,
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
PRICE_AGE_SCOPES = {
    "postal_code": "this postal code",
    "price_sub_area": "the postal codes of this price area",
    "municipality": "the postal codes of this municipality",
    "region": "the postal codes of this region",
    "country": "all postal codes in Finland",
}
# From 2010 on, capital charges mostly repay the construction loan, which the
# housing company loan share already covers; such buildings get the 2000s level.
LOAN_DRIVEN_FROM_YEAR = 2010


@dataclass(frozen=True)
class AgeClass:
    first_year: int | None
    last_year: int | None
    maintenance_charge: float
    capital_charge: float

    def contains(self, year: int) -> bool:
        return (self.first_year is None or self.first_year <= year) and (
            self.last_year is None or year <= self.last_year
        )


@dataclass(frozen=True)
class Defaults:
    """Default scenario, where each value comes from, and the alternative rent growth rule."""

    scenario: ScenarioInput
    sources: dict[str, str]
    rent_growth_market: float
    rent_growth_lease_clause: float
    price_age_ratio: float = 1.0
    aso_fee_share: float = 0.0
    aso_charge_share: float = 0.0


class DefaultsError(LookupError):
    pass


def _cagr(start: float, end: float, years: int) -> float:
    return (end / start) ** (1 / years) - 1


def _class_for(classes: list[AgeClass], construction_year: int) -> AgeClass:
    return next(item for item in classes if item.contains(construction_year))


def capital_charge_schedule(
    classes: list[AgeClass], statistics_year: int, start_year: int, building_year: int | None
) -> tuple[float, ...]:
    """Capital charge per m² per month in each year from `start_year`, by building age.

    A building that reaches age A in some year pays what buildings of age A pay in the
    statistics year.
    """
    renovation = [
        item for item in classes if item.last_year and item.last_year < LOAN_DRIVEN_FROM_YEAR
    ]
    if building_year is None:
        level = statistics.fmean(item.capital_charge for item in renovation)
        return (level,)
    newest = _class_for(classes, LOAN_DRIVEN_FROM_YEAR - 1)
    schedule = []
    for offset in range(MAX_YEARS):
        age = max(start_year + offset - building_year, 0)
        peer_year = statistics_year - age
        peer = newest if peer_year >= LOAN_DRIVEN_FROM_YEAR else _class_for(classes, peer_year)
        schedule.append(peer.capital_charge)
    return tuple(schedule)


def load_defaults(
    postal_code: str,
    room_type: str,
    size_m2: float,
    horizon_years: int = 5,
    purchase_date: dt.date | None = None,
    first_home: bool = False,
    buyer_age: int | None = None,
    warehouse: Path | None = None,
    building_year: int | None = None,
) -> Defaults:
    purchase_date = purchase_date or dt.date.today()
    with connect_read_only(warehouse) as connection:

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
            market_rent_growth,
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
        deposit_rate, deposit_month = one(
            """
            select new_deposit_rate_up_to_1y_pct / 100, month_start_date
            from marts.fct_interest_rates
            where new_deposit_rate_up_to_1y_pct is not null
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

        cpi_end, cpi_start, cpi_year = one(
            f"""
            select latest.consumer_price_index_2015, earlier.consumer_price_index_2015,
                latest.period_label
            from marts.fct_consumer_price_index as latest
            inner join marts.fct_consumer_price_index as earlier
                on extract(year from earlier.period_start_date)
                    = extract(year from latest.period_start_date) - {GROWTH_YEARS}
            order by latest.period_start_date desc
            limit 1
            """
        )

        age_rows = connection.execute(
            """
            select period_label, construction_period_code, first_construction_year,
                last_construction_year,
                max(case when account_item_code = 'k3001' then value_eur_per_m2_month end),
                max(case when account_item_code = 'k3283' then value_eur_per_m2_month end)
            from marts.fct_housing_company_charges_by_age
            where building_type = 'block_of_flats'
                and period_start_date = (
                    select max(period_start_date) from marts.fct_housing_company_charges_by_age
                )
            group by all
            order by construction_period_code
            """
        ).fetchall()
        if not age_rows:
            raise DefaultsError("No housing company charges by building age")
        charges_year = int(age_rows[0][0])
        all_ages = next(row for row in age_rows if row[1] == "0")
        classes = [AgeClass(row[2], row[3], row[4], row[5]) for row in age_rows if row[1] != "0"]

        repairs_per_m2_year, repairs_first, repairs_last = one(
            """
            select avg(renovation_costs_eur_per_m2_year), min(period_label), max(period_label)
            from (
                select renovation_costs_eur_per_m2_year, period_label
                from marts.fct_owner_renovation_costs
                where building_type = 'block_of_flats' and structure_element_code = 'SSS'
                order by period_start_date desc
                limit (select cast(value as integer) from seeds.assumptions
                       where parameter_code = 'owner_renovation_cost_years')
            )
            """
        )

        aso_changes = [
            row[0]
            for row in connection.execute(
                "select annual_change_pct / 100 from seeds.aso_charge_changes order by year"
            ).fetchall()
        ]
        aso_change_years = connection.execute(
            "select min(year), max(year) from seeds.aso_charge_changes"
        ).fetchone()

        price_age = None
        if building_year is not None:
            price_age = one(
                """
                select price_ratio, geography_level, first_construction_year,
                    last_construction_year, first_period_label, last_period_label
                from marts.mart_price_construction_ratios
                where postal_code = ?
                    and coalesce(first_construction_year, ?) <= ?
                    and ? <= coalesce(last_construction_year, ?)
                """,
                [postal_code, *[building_year] * 4],
            )

        asp_major_city = (
            connection.execute(
                "select count(*) from seeds.asp_major_cities where municipality_code = ?",
                [municipality_code],
            ).fetchone()[0]
            > 0
        )
        assumptions = dict(
            connection.execute("select parameter_code, value from seeds.assumptions").fetchall()
        )
        policy_rows = [
            PolicyRow(*row)
            for row in connection.execute(
                "select parameter_code, value, valid_from, valid_to from seeds.policy_parameters"
            ).fetchall()
        ]

    policy = resolve_policy(policy_rows, purchase_date, first_home, buyer_age, asp_major_city)
    maintenance_growth = _cagr(charge_start, charge_end, GROWTH_YEARS)
    index_growth = _cagr(index_start, index_end, GROWTH_YEARS)
    inflation = _cagr(cpi_start, cpi_end, GROWTH_YEARS)
    lease_clause_growth = max(assumptions["rent_growth_floor"], inflation)
    aso_charge_growth = statistics.geometric_mean(1 + change for change in aso_changes) - 1

    age_note = "all building ages"
    if building_year is not None:
        own_class = _class_for(classes, building_year)
        maintenance_charge *= own_class.maintenance_charge / all_ages[4]
        age_note = f"buildings from {building_year}"
    capital_charges = capital_charge_schedule(
        classes, charges_year, purchase_date.year, building_year
    )

    price_age_ratio = 1.0
    price_age_note = "Prices are not split by building age"
    if price_age is not None:
        price_age_ratio, level, first_year, last_year, first_period, last_period = price_age
        if first_year is None:
            built = f"before {last_year + 1}"
        elif last_year is None:
            built = f"from {first_year} on"
        else:
            built = f"from {first_year} to {last_year}"
        price_age_note = (
            f"Flats built {built} sold for {price_age_ratio:.2f} times the average price per m² "
            f"of all flats in the same postal code, {first_period} to {last_period}, "
            f"averaged over {PRICE_AGE_SCOPES[level]} (Statistics Finland)"
        )

    buy_price_per_m2 = price_per_m2 * price_age_ratio
    aso_fee_share = assumptions["aso_fee_share_of_price"]
    aso_charge_share = assumptions["aso_charge_share_of_rent"]
    invest = assumptions["invest_surplus_by_default"] == 1
    fixed = assumptions["fixed_rate_by_default"] == 1
    loan_term = int(assumptions["loan_term_years"])

    scenario = ScenarioInput(
        size_m2=size_m2,
        horizon_years=horizon_years,
        buy=BuyInput(
            price_per_m2=buy_price_per_m2,
            price_growth=price_growth,
            maintenance_charge_per_m2_month=maintenance_charge,
            maintenance_charge_growth=aso_charge_growth,
            capital_charges_per_m2_month=capital_charges,
            own_repairs_per_m2_year=repairs_per_m2_year,
            selling_cost_rate=assumptions["selling_cost_rate"],
            mortgage=MortgageInput(
                down_payment_share=assumptions["down_payment_share"],
                term_years=loan_term,
                rate_type="fixed" if fixed else "variable",
                rate_path=RatePath(kind="flat", start_rate=variable_rate),
                fixed_rate=variable_rate if fixed else None,
                fixed_years=loan_term if fixed else None,
            ),
        ),
        rent=RentInput(rent_per_m2_month=rent_per_m2, rent_growth=lease_clause_growth),
        aso=AsoInput(
            fee_per_m2=aso_fee_share * buy_price_per_m2,
            charge_per_m2_month=aso_charge_share * rent_per_m2,
            charge_growth=aso_charge_growth,
            building_cost_index_growth=assumptions["aso_fee_growth"],
        ),
        investment=InvestmentInput(
            surplus_strategy="invest" if invest else "park",
            investment_return=assumptions["investment_return_rate"],
            parked_cash_return=deposit_rate,
        ),
        policy=policy,
    )
    sources = {
        "price_per_m2": f"Statistics Finland, {price_level} level, {price_period}",
        "price_building_age": price_age_note,
        "rent_per_m2_month": (
            f"Statistics Finland, non-subsidised, {rent_level} level, {rent_period}"
        ),
        "price_growth": f"Price index, average growth over {GROWTH_YEARS} years",
        "rent_growth": (
            f"Lease clause: inflation {inflation:.1%} a year over {GROWTH_YEARS} years to "
            f"{cpi_year}, at least {assumptions['rent_growth_floor']:.0%}"
        ),
        "rent_growth_market": f"Market rents here, average growth over {GROWTH_YEARS} years",
        "maintenance_charge": (
            f"Housing company finances, area {charge_area}, {charge_end_year}, {age_note}"
        ),
        "maintenance_charge_growth": (
            f"Same as right-of-occupancy charges, {aso_change_years[0]} to "
            f"{aso_change_years[1]} (Varke). Housing company charges in this region "
            f"grew {maintenance_growth:.1%} a year over {GROWTH_YEARS} years"
        ),
        "capital_charges": (
            f"Housing company capital charges by building age, {charges_year}, {age_note}"
        ),
        "own_repairs": (
            f"Renovations owner-occupiers of flats pay themselves, "
            f"average of {repairs_first} to {repairs_last}"
        ),
        "mortgage_rate": (
            f"ECB, average variable rate on new housing loans in Finland, {rate_month:%Y-%m}"
            + (", fixed for the whole loan term" if fixed else "")
        ),
        "savings_rate": (
            f"ECB, new household deposits up to one year in Finland, {deposit_month:%Y-%m}"
        ),
        "aso_fee": (
            f"Assumption: {aso_fee_share:.0%} of the buy price. The Act on right-of-occupancy "
            "dwellings (393/2021, section 9) caps fees at 15% of the building's acquisition "
            "cost in state-subsidised buildings; the buy price stands in for that cost"
        ),
        "aso_charge": (
            f"Assumption: {aso_charge_share:.0%} of the market rent here. The Act "
            "(section 33) requires charges below the rent of comparable rental flats"
        ),
        "aso_charge_growth": (
            f"Right-of-occupancy charges in Finland, average change "
            f"{aso_change_years[0]} to {aso_change_years[1]} (Varke)"
        ),
        "building_cost_index_growth": (
            f"Assumption. The building cost index grew {index_growth:.1%} a year over "
            f"{GROWTH_YEARS} years to {index_month:%Y-%m}"
        ),
        "policy": f"Tax and lending rules valid on {purchase_date:%Y-%m-%d}",
        "assumptions": "Calculator assumptions (editable)",
    }
    return Defaults(
        scenario=scenario,
        sources=sources,
        rent_growth_market=market_rent_growth,
        rent_growth_lease_clause=lease_clause_growth,
        price_age_ratio=price_age_ratio,
        aso_fee_share=aso_fee_share,
        aso_charge_share=aso_charge_share,
    )
