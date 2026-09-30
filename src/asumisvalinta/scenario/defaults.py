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
SIMILAR_AGE_YEARS = 10
MIN_SAMPLE = 3
# From 2010 on, capital charges mostly repay the construction loan, which the
# housing company loan share already covers; such buildings get the 2000s level.
LOAN_DRIVEN_FROM_YEAR = 2010


@dataclass(frozen=True)
class AsoSample:
    """Sampled right-of-occupancy buildings, scaled to the market of the chosen area.

    `fee_per_m2` and `charge_per_m2` are quartiles for this area: each sampled building's
    fee relative to the price per m² and charge relative to the rent per m² where it
    stands, applied to the price and rent of the chosen area.
    """

    scope: str
    buildings: int
    fee_per_m2: tuple[float, float, float]
    charge_per_m2: tuple[float, float, float]
    charge_to_rent: float
    fee_to_price: float


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
    scenario: ScenarioInput
    sources: dict[str, str]
    aso_sample: AsoSample


class DefaultsError(LookupError):
    pass


def _quartiles(values: list[float]) -> tuple[float, float, float]:
    """Lower quartile, median and upper quartile."""
    if len(values) == 1:
        return (values[0], values[0], values[0])
    lower, median, upper = statistics.quantiles(values, n=4, method="inclusive")
    return (lower, median, upper)


def _cagr(start: float, end: float, years: int) -> float:
    return (end / start) ** (1 / years) - 1


def _similar_age(
    offers: list[tuple[float, float, int]], building_year: int | None
) -> tuple[list[tuple[float, float, int]], str]:
    if building_year is not None:
        similar = [o for o in offers if abs(o[2] - building_year) <= SIMILAR_AGE_YEARS]
        if len(similar) >= MIN_SAMPLE:
            return similar, f"built within {SIMILAR_AGE_YEARS} years of {building_year}"
    return offers, "all building ages"


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
        ) = one(
            """
            select municipality_code, price_per_m2, price_geography_level, price_period_label,
                rent_per_m2, rent_geography_level, rent_period_label,
                maintenance_charge_per_m2, maintenance_charge_area_code,
                coalesce(price_cagr_10y, price_cagr_5y)
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

        offers = connection.execute(
            """
            select offers.right_of_occupancy_fee_avg_eur_per_m2 / levels.price_per_m2,
                offers.monthly_charge_eur_per_m2 / levels.rent_per_m2,
                offers.building_year
            from seeds.aso_offers as offers
            inner join marts.mart_market_levels as levels
                on offers.postal_code = levels.postal_code and levels.room_type = ?
            where levels.price_per_m2 > 0 and levels.rent_per_m2 > 0
            """,
            [room_type],
        ).fetchall()
        if not offers:
            raise DefaultsError("No right-of-occupancy sample")

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
    rent_growth = max(assumptions["rent_growth_floor"], inflation)

    age_note = "all building ages"
    if building_year is not None:
        own_class = _class_for(classes, building_year)
        maintenance_charge *= own_class.maintenance_charge / all_ages[4]
        age_note = f"buildings from {building_year}"
    capital_charges = capital_charge_schedule(
        classes, charges_year, purchase_date.year, building_year
    )

    sample, age_scope = _similar_age(offers, building_year)
    fee_to_price = _quartiles([row[0] for row in sample])
    charge_to_rent = _quartiles([row[1] for row in sample])
    aso_sample = AsoSample(
        scope=age_scope,
        buildings=len(sample),
        fee_per_m2=tuple(ratio * price_per_m2 for ratio in fee_to_price),
        charge_per_m2=tuple(ratio * rent_per_m2 for ratio in charge_to_rent),
        charge_to_rent=charge_to_rent[1],
        fee_to_price=fee_to_price[1],
    )
    invest = assumptions["invest_surplus_by_default"] == 1

    scenario = ScenarioInput(
        size_m2=size_m2,
        horizon_years=horizon_years,
        buy=BuyInput(
            price_per_m2=price_per_m2,
            price_growth=price_growth,
            maintenance_charge_per_m2_month=maintenance_charge,
            maintenance_charge_growth=maintenance_growth,
            capital_charges_per_m2_month=capital_charges,
            own_repairs_per_m2_year=repairs_per_m2_year,
            selling_cost_rate=assumptions["selling_cost_rate"],
            mortgage=MortgageInput(
                down_payment_share=assumptions["down_payment_share"],
                term_years=int(assumptions["loan_term_years"]),
                rate_path=RatePath(kind="flat", start_rate=variable_rate),
            ),
        ),
        rent=RentInput(rent_per_m2_month=rent_per_m2, rent_growth=rent_growth),
        aso=AsoInput(
            fee_per_m2=aso_sample.fee_per_m2[1],
            charge_per_m2_month=aso_sample.charge_per_m2[1],
            charge_growth=maintenance_growth,
            building_cost_index_growth=index_growth,
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
        "rent_per_m2_month": (
            f"Statistics Finland, non-subsidised, {rent_level} level, {rent_period}"
        ),
        "price_growth": f"Price index, average growth over {GROWTH_YEARS} years",
        "rent_growth": (
            f"Inflation {inflation:.1%} a year over {GROWTH_YEARS} years to {cpi_year} "
            f"(consumer price index), at least {assumptions['rent_growth_floor']:.0%}"
        ),
        "maintenance_charge": (
            f"Housing company finances, area {charge_area}, {charge_end_year}, {age_note}"
        ),
        "maintenance_charge_growth": f"Housing company finances, {GROWTH_YEARS}-year growth",
        "capital_charges": (
            f"Housing company capital charges by building age, {charges_year}, {age_note}"
        ),
        "own_repairs": (
            f"Renovations owner-occupiers of flats pay themselves, "
            f"average of {repairs_first} to {repairs_last}"
        ),
        "mortgage_rate": f"ECB, variable rate on new housing loans in Finland, {rate_month:%Y-%m}",
        "savings_rate": (
            f"ECB, new household deposits up to one year in Finland, {deposit_month:%Y-%m}"
        ),
        "aso_fee_and_charge": (
            f"{aso_sample.buildings} Asuntosäätiö buildings ({age_scope}): charges "
            f"{aso_sample.charge_to_rent:.0%} of the market rent and fees "
            f"{aso_sample.fee_to_price:.0%} of the price per m² where each building stands"
        ),
        "aso_charge_growth": "Cost-based, equal to housing company charge growth",
        "building_cost_index_growth": (
            f"Building cost index, {GROWTH_YEARS}-year growth to {index_month:%Y-%m}"
        ),
        "policy": f"Tax and lending rules valid on {purchase_date:%Y-%m-%d}",
        "assumptions": "Calculator assumptions (editable)",
    }
    return Defaults(scenario=scenario, sources=sources, aso_sample=aso_sample)
