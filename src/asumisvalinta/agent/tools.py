"""Tools the agents can call. Every tool returns JSON text for the model."""

import datetime as dt
import json
import re
import statistics
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import duckdb

from asumisvalinta.config import connect_read_only
from asumisvalinta.scenario import simulate
from asumisvalinta.scenario.defaults import load_defaults
from asumisvalinta.scenario.overrides import ScenarioOverrides, apply_overrides
from asumisvalinta.semantic import Filter, MetricQuery, SemanticLayer
from asumisvalinta.semantic.client import DBT_PROJECT_DIR

MAX_ROWS = 200
ROOM_TYPES = ["one_room", "two_room", "three_room_plus"]
FLAT_LABELS = {
    "one_room": "studio",
    "two_room": "1 bedroom",
    "three_room_plus": "2+ bedrooms",
    "all": "all flats",
}
ANSWER_TOOL = "submit_answer"
MAX_SIZES = 31

SIMPLIFICATIONS = [
    "All amounts are nominal euros; growth rates are annual.",
    "Every option starts with the same capital and spends the same amount each month; "
    "the difference to the most expensive option is invested or kept in a bank account.",
    "The owner lives in the flat for the whole horizon; a sale after two years is tax-free.",
    "Gains on money put aside are taxed once at the end of the horizon.",
    "The right-of-occupancy fee is indexed with the building cost index from move-in.",
    "Major renovations are excluded unless a renovation reserve is entered.",
]


class ToolError(Exception):
    """An error the model can act on, returned to it as the tool result."""


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[..., Any]

    @property
    def schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


def to_json(value: Any) -> str:
    def default(item: Any) -> Any:
        if isinstance(item, dt.date | dt.datetime):
            return item.isoformat()
        if isinstance(item, Decimal):
            return float(item)
        return str(item)

    return json.dumps(value, default=default, ensure_ascii=False)


def _round(value: Any) -> Any:
    return round(value, 4) if isinstance(value, float) else value


def answer_tool() -> Tool:
    def submit_answer(**answer: Any) -> dict[str, Any]:
        return {"received": True}

    return Tool(
        name=ANSWER_TOOL,
        description=(
            "Submit the final answer. Call it exactly once, at the end. For a numeric answer put "
            "the single number a tool returned in `value`, in the unit asked for."
        ),
        parameters={
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["answered", "refused", "needs_clarification"],
                },
                "answer": {
                    "type": "string",
                    "description": "Answer for the user, in the language of the question.",
                },
                "value": {"type": ["number", "null"], "description": "Main number, if any."},
                "unit": {"type": ["string", "null"]},
                "sources": {
                    "type": "string",
                    "description": "Metrics or tables, periods and geography levels used.",
                },
                "chart": {
                    "type": ["object", "null"],
                    "description": "Data for a chart the site draws, or null.",
                    "properties": {
                        "kind": {"type": "string", "enum": ["bar", "line"]},
                        "title": {"type": "string"},
                        "unit": {"type": ["string", "null"]},
                        "x_label": {"type": "string", "description": "What the x axis shows."},
                        "y_label": {"type": "string", "description": "What the values measure."},
                        "categories": {"type": "array", "items": {"type": "string"}},
                        "series": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "values": {
                                        "type": "array",
                                        "items": {"type": ["number", "null"]},
                                    },
                                },
                                "required": ["name", "values"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": [
                        "kind",
                        "title",
                        "unit",
                        "x_label",
                        "y_label",
                        "categories",
                        "series",
                    ],
                    "additionalProperties": False,
                },
            },
            "required": ["status", "answer", "value", "unit", "sources", "chart"],
            "additionalProperties": False,
        },
        handler=submit_answer,
    )


def scenario_tools(warehouse: Path) -> list[Tool]:
    def run_scenario(
        postal_code: str,
        room_type: str,
        size_m2: float,
        horizon_years: int,
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            defaults = load_defaults(
                postal_code, room_type, size_m2, horizon_years, warehouse=warehouse
            )
        except LookupError as error:
            raise ToolError(f"No market data for postal code {postal_code}: {error}") from error
        scenario = apply_overrides(defaults.scenario, ScenarioOverrides(**(overrides or {})))
        result = simulate(scenario)
        return {
            "horizon_years": result.horizon_years,
            "initial_capital": round(result.initial_capital, 2),
            "options": {
                option.option: {
                    "end_wealth": round(option.end_wealth, 2),
                    "total_paid": round(option.total_paid, 2),
                    "upfront_payment": round(option.upfront_payment, 2),
                }
                for option in result.options
            },
            "break_even_years_buy_vs_rent": result.break_even_years_buy_vs_rent,
            "break_even_years_buy_vs_aso": result.break_even_years_buy_vs_aso,
            "inputs": _inputs_summary(scenario),
            "sources": defaults.sources,
            "warnings": list(result.warnings),
        }

    def explain_assumptions(postal_code: str, room_type: str) -> dict[str, Any]:
        try:
            defaults = load_defaults(postal_code, room_type, 50, warehouse=warehouse)
        except LookupError as error:
            raise ToolError(f"No market data for postal code {postal_code}: {error}") from error
        return {
            "defaults": _inputs_summary(defaults.scenario),
            "sources": defaults.sources,
            "simplifications": SIMPLIFICATIONS,
        }

    location = {
        "postal_code": {"type": "string", "description": "Five-digit Finnish postal code."},
        "room_type": {"type": "string", "enum": ROOM_TYPES},
    }
    return [
        Tool(
            name="run_scenario",
            description=(
                "Compare buying, renting and right of occupancy (asumisoikeus) for a flat over a "
                "horizon with the deterministic scenario engine. Defaults come from official "
                "statistics; `overrides` changes them. Rates and growth rates are annual decimals "
                "(0.03 = 3 %)."
            ),
            parameters={
                "type": "object",
                "properties": {
                    **location,
                    "size_m2": {"type": "number"},
                    "horizon_years": {"type": "integer", "minimum": 1, "maximum": 30},
                    "overrides": {
                        "type": "object",
                        "description": "Optional changes to the default inputs.",
                        "properties": {
                            name: {"type": ["number", "string", "null"]}
                            for name in ScenarioOverrides.model_fields
                        },
                        "additionalProperties": False,
                    },
                },
                "required": ["postal_code", "room_type", "size_m2", "horizon_years"],
            },
            handler=run_scenario,
        ),
        Tool(
            name="explain_assumptions",
            description=(
                "Default inputs of the scenario engine for a postal code and room type, where each "
                "comes from, and the simplifications of the method."
            ),
            parameters={
                "type": "object",
                "properties": location,
                "required": ["postal_code", "room_type"],
            },
            handler=explain_assumptions,
        ),
    ]


def _inputs_summary(scenario: Any) -> dict[str, Any]:
    buy, rent, aso = scenario.buy, scenario.rent, scenario.aso
    summary = {
        "size_m2": scenario.size_m2,
        "price_per_m2": buy.price_per_m2,
        "price_growth": _round(buy.price_growth),
        "rent_per_m2_month": rent.rent_per_m2_month,
        "rent_growth": _round(rent.rent_growth),
        "maintenance_charge_per_m2_month": buy.maintenance_charge_per_m2_month,
        "interest_rate": _round(buy.mortgage.rate_path.start_rate),
        "rate_path": buy.mortgage.rate_path.kind,
        "rate_type": buy.mortgage.rate_type,
        "fixed_years": buy.mortgage.fixed_years,
        "down_payment_share": buy.mortgage.down_payment_share,
        "loan_term_years": buy.mortgage.term_years,
        "selling_cost_rate": buy.selling_cost_rate,
        "investment_return": scenario.investment.investment_return,
        "surplus_strategy": scenario.investment.surplus_strategy,
        "transfer_tax_rate": scenario.policy.transfer_tax_rate,
    }
    if aso:
        summary["aso_fee_per_m2"] = _round(aso.fee_per_m2)
        summary["aso_charge_per_m2_month"] = _round(aso.charge_per_m2_month)
    return summary


FILTER_GUIDE = (
    "Filters are objects {field, operator, value}. `field` is an entity (postal_area, room_type, "
    "area), a dimension such as dwelling_price__building_type, or a time grain such as "
    "metric_time__quarter. Operators: =, !=, >, >=, <, <=, in (value is then a list). Values: "
    "postal_area = five-digit postal code; room_type = one_room, two_room, three_room_plus or "
    "all (the published figure for all room types); building types = block_of_flats, "
    "terraced_house or all; area = '<scheme>:<code>' from search_areas, for example "
    "price_area:091 (Helsinki, prices), rent_area:091 (Helsinki, rents), rent_area:091_1 (rent "
    "sub-area Helsinki 1), price_area:SSS and rent_area:SSS (whole country), "
    "housing_finance_area:pks (Greater Helsinki, charges). Time values: 2025, 2025Q4, 2025-07 or "
    "a date. Price, rent and charge metrics must fix room type, building type and area to one "
    "value each (or group by them); the tool says what is missing. Query the time grain the "
    "question asks for (metric_time__year for a year) instead of combining values yourself."
)
EMPTY_RESULT_HINT = (
    "No value matched. Check the filter values with list_dimension_values or search_areas, and "
    "whether the period has published data. Postal codes publish flat prices by room type only: "
    "leave room_type out to cover all flats of a postal code."
)
MAX_RANKED = 20


@dataclass(frozen=True)
class _Ranking:
    metric: str
    unit: str
    description: str
    names: tuple[str, ...]
    filters: tuple[Filter, ...]


def _ranking(measure: str, level: str, room_type: str) -> _Ranking:
    room = (Filter("room_type", "=", room_type),)
    if measure == "price":
        flats = (Filter("dwelling_price__building_type", "=", "block_of_flats"), *room)
        price = "average price per m² of old flats in blocks of flats, yearly statistics"
        if level == "postal_code":
            # Postal codes publish flats by room type only; the metric weights them by sales.
            if room_type == "all":
                flats = (
                    Filter("dwelling_price__building_type", "=", "block_of_flats"),
                    Filter("room_type", "in", ROOM_TYPES),
                )
            return _Ranking(
                "avg_price_per_m2_annual",
                "€/m²",
                price,
                ("postal_area", "postal_area__postal_area_name", "postal_area__municipality_name"),
                (Filter("dwelling_price__geography_level", "=", "postal_code"), *flats),
            )
        if level == "municipality":
            return _Ranking(
                "avg_price_per_m2_annual",
                "€/m²",
                price,
                ("area", "area__area_name"),
                (Filter("area__area_scheme", "=", "municipality_2015"), *flats),
            )
    if measure == "rent" and level in ("sub_area", "municipality"):
        return _Ranking(
            "avg_rent_per_m2",
            "€/m² per month",
            "average monthly rent per m² of free-market rental flats",
            ("area", "area__area_name"),
            (
                Filter("area__area_scheme", "=", "rent_area"),
                Filter("area__area_level", "=", level),
                *room,
            ),
        )
    raise ToolError(
        "Prices rank by postal_code or municipality; rents rank by sub_area or municipality."
    )


def _year(value: Any) -> int:
    return value.year if isinstance(value, dt.date) else int(str(value)[:4])


def semantic_tools(semantic_layer: SemanticLayer, warehouse: Path) -> list[Tool]:
    def list_metrics() -> list[dict[str, str]]:
        return [
            {"name": metric.name, "label": metric.label, "description": metric.description}
            for metric in semantic_layer.list_metrics()
        ]

    def list_dimensions(metrics: list[str]) -> list[str]:
        try:
            return semantic_layer.list_dimensions(metrics)
        except ValueError as error:
            raise ToolError(str(error)) from error

    def list_dimension_values(metrics: list[str], dimension: str) -> list[str]:
        if dimension == "room_type":
            return [*ROOM_TYPES, "all"]
        if dimension in ("area", "postal_area"):
            raise ToolError(f"Use search_areas to find {dimension} keys.")
        try:
            return semantic_layer.dimension_values(metrics, dimension)[:MAX_ROWS]
        except Exception as error:
            raise ToolError(
                f"{error}. Entities (postal_area, room_type, area) cannot be listed; see the "
                "query_metrics description and use search_areas."
            ) from error

    def search_areas(text: str) -> dict[str, Any]:
        pattern = f"%{text.strip().lower()}%"
        with connect_read_only(warehouse) as connection:
            areas = connection.execute(
                "select area_key, area_name, area_scheme, area_level from marts.dim_area "
                "where lower(area_name) like ? or lower(area_code) like ? "
                "order by area_scheme, area_level, area_name limit 40",
                [pattern, pattern],
            ).fetchall()
            postal_areas = connection.execute(
                "select postal_code, postal_area_name, municipality_name from "
                "marts.dim_postal_area where lower(postal_area_name) like ? "
                "or lower(municipality_name) like ? or postal_code like ? "
                "order by postal_code limit 40",
                [pattern, pattern, pattern],
            ).fetchall()
        return {
            "areas": [
                {"area": key, "name": name, "scheme": scheme, "level": level}
                for key, name, scheme, level in areas
            ],
            "postal_areas": [
                {"postal_area": code, "name": name, "municipality": municipality}
                for code, name, municipality in postal_areas
            ],
        }

    def query_metrics(
        metrics: list[str],
        group_by: list[str] | None = None,
        filters: list[dict[str, Any]] | None = None,
        order_by: list[str] | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        try:
            conditions = tuple(Filter(**condition) for condition in filters or ())
        except (TypeError, ValueError) as error:
            raise ToolError(f"Invalid filter: {error}") from error
        grouping = list(group_by or ())
        for condition in conditions:
            if condition.field.startswith("metric_time__") and condition.field not in grouping:
                grouping.append(condition.field)
        query = MetricQuery(
            metrics=tuple(metrics),
            group_by=tuple(grouping),
            filters=conditions,
            order_by=tuple(order_by or ()),
            limit=min(limit or MAX_ROWS, MAX_ROWS),
        )
        try:
            missing = semantic_layer.missing_grain(query)
        except ValueError as error:
            raise ToolError(str(error)) from error
        if missing:
            raise ToolError(
                "Fix these to one value with an = filter, or group by them, so published totals "
                f"and details are not added together: {', '.join(missing)}."
            )
        try:
            result = semantic_layer.query(query)
        except Exception as error:
            raise ToolError(f"Query failed: {error}") from error
        rows = [[_round(value) for value in row] for row in result.rows]
        response: dict[str, Any] = {"columns": list(result.columns), "rows": rows}
        metric_columns = [result.columns.index(name) for name in metrics]
        if not any(row[i] is not None for row in rows for i in metric_columns):
            response["note"] = EMPTY_RESULT_HINT
        return response

    def area_prices(postal_code: str) -> dict[str, Any]:
        result = semantic_layer.query(
            MetricQuery(
                metrics=("current_price_per_m2", "current_rent_per_m2"),
                group_by=(
                    "room_type",
                    "postal_area__postal_area_name",
                    "postal_area__municipality_name",
                    "market_level__price_geography_level",
                    "market_level__price_period_label",
                    "market_level__rent_geography_level",
                    "market_level__rent_period_label",
                ),
                filters=(Filter("postal_area", "=", postal_code.strip()),),
            )
        )
        if not result.rows:
            raise ToolError(f"No market data for postal code {postal_code}. Use search_areas.")
        rows = [dict(zip(result.columns, row, strict=True)) for row in result.rows]
        first = rows[0]
        return {
            "postal_code": postal_code.strip(),
            "name": first["postal_area__postal_area_name"],
            "municipality": first["postal_area__municipality_name"],
            "by_room_type": [
                {
                    "flat": FLAT_LABELS.get(row["room_type"], row["room_type"]),
                    "price_per_m2": None
                    if row["current_price_per_m2"] is None
                    else round(row["current_price_per_m2"]),
                    "price_area_level": row["market_level__price_geography_level"],
                    "price_period": row["market_level__price_period_label"],
                    "rent_per_m2_month": _round(row["current_rent_per_m2"]),
                    "rent_area_level": row["market_level__rent_geography_level"],
                    "rent_period": row["market_level__rent_period_label"],
                }
                for row in sorted(rows, key=lambda row: str(row["room_type"]))
            ],
        }

    def flat_costs(
        postal_code: str,
        room_type: str,
        min_m2: float,
        max_m2: float | None = None,
        step_m2: float = 1,
    ) -> dict[str, Any]:
        top = min_m2 if max_m2 is None else max_m2
        if not 10 <= min_m2 <= top <= 300 or step_m2 <= 0:
            raise ToolError("Sizes run from 10 to 300 m², with min_m2 at most max_m2.")
        count = int((top - min_m2) / step_m2 + 1e-9) + 1
        if count > MAX_SIZES:
            raise ToolError(f"At most {MAX_SIZES} sizes; use a larger step_m2.")
        latest = area_prices(postal_code)
        flat = FLAT_LABELS.get(room_type)
        row = next((row for row in latest["by_room_type"] if row["flat"] == flat), None)
        if row is None:
            raise ToolError(f"No figures for {room_type} flats in {postal_code}.")
        rent, price = row["rent_per_m2_month"], row["price_per_m2"]
        sizes = [round(min_m2 + index * step_m2, 1) for index in range(count)]
        return {
            "postal_code": latest["postal_code"],
            "name": latest["name"],
            "municipality": latest["municipality"],
            "flat": flat,
            "rent_per_m2_month": rent,
            "rent_period": row["rent_period"],
            "rent_area_level": row["rent_area_level"],
            "price_per_m2": price,
            "price_period": row["price_period"],
            "price_area_level": row["price_area_level"],
            "note": "Estimates: the latest rent and price per m² times the flat size.",
            "by_size": [
                {
                    "size_m2": size,
                    "monthly_rent": None if rent is None else round(rent * size),
                    "price": None if price is None else round(price * size),
                }
                for size in sizes
            ],
        }

    def latest_quarter(
        metrics: tuple[str, ...], area: str, *filters: Filter
    ) -> tuple[str, list[dict[str, Any]]] | None:
        result = semantic_layer.query(
            MetricQuery(
                metrics=metrics,
                group_by=("metric_time__quarter", "room_type"),
                filters=(Filter("area", "=", area), *filters),
            )
        )
        rows = [dict(zip(result.columns, row, strict=True)) for row in result.rows]
        rows = [row for row in rows if row[metrics[-1]] is not None]
        if not rows:
            return None
        latest = max(row["metric_time__quarter"] for row in rows)
        label = f"{latest.year}Q{(latest.month - 1) // 3 + 1}"
        return label, [row for row in rows if row["metric_time__quarter"] == latest]

    def price_spread(area: str) -> dict[str, Any]:
        scheme, _, code = area.strip().partition(":")
        if not code:
            raise ToolError("Give an area key from search_areas, for example price_area:091.")
        municipal = scheme == "municipality_2015" or (len(code) == 3 and code.isdigit())
        price_area = f"price_area:{code}" if municipal or scheme == "price_area" else None
        rent_area = f"rent_area:{code}" if municipal or scheme == "rent_area" else None
        spread: dict[str, Any] = {"area": area.strip()}

        quartiles = ("price_per_m2_lower_quartile", "price_per_m2_upper_quartile")
        prices = price_area and latest_quarter(
            (*quartiles, "price_per_m2_median"),
            price_area,
            Filter("price_distribution__building_type", "=", "block_of_flats"),
        )
        if prices:
            period, rows = prices
            averages = latest_quarter(
                ("avg_price_per_m2",),
                price_area,
                Filter("dwelling_price__building_type", "=", "block_of_flats"),
                Filter("metric_time__quarter", "=", period),
            )
            average = (
                {row["room_type"]: row["avg_price_per_m2"] for row in averages[1]}
                if averages
                else {}
            )
            spread["prices_per_m2"] = {
                "area": price_area,
                "period": period,
                "dwellings": "flats in blocks of flats",
                "by_flat": [
                    {
                        "flat": FLAT_LABELS.get(row["room_type"], row["room_type"]),
                        "average": None
                        if average.get(row["room_type"]) is None
                        else round(average[row["room_type"]]),
                        "lower_quartile": round(row["price_per_m2_lower_quartile"]),
                        "median": round(row["price_per_m2_median"]),
                        "upper_quartile": round(row["price_per_m2_upper_quartile"]),
                    }
                    for row in sorted(rows, key=lambda row: str(row["room_type"]))
                ],
            }
        if prices and municipal:
            with connect_read_only(warehouse) as connection:
                found = connection.execute(
                    "select area_name from marts.dim_area where area_key = ?",
                    [f"municipality_2015:{code}"],
                ).fetchone()
            if found:
                ends = {}
                for order in ("lowest", "highest"):
                    ranked = rank_areas("price", "postal_code", order, within=found[0], limit=1)
                    row = ranked["rows"][0]
                    ends[order] = {
                        "postal_code": row["postal_code"],
                        "name": row["postal_area_name"],
                        "average_price_per_m2": row["value"],
                        "period": ranked["period"],
                    }
                spread["prices_per_m2"]["cheapest_postal_area"] = ends["lowest"]
                spread["prices_per_m2"]["most_expensive_postal_area"] = ends["highest"]
        rents = rent_area and latest_quarter(
            ("rent_lower_quartile", "rent_upper_quartile", "rent_median"), rent_area
        )
        if rents:
            period, rows = rents
            spread["monthly_rents"] = {
                "area": rent_area,
                "period": period,
                "dwellings": "non-subsidised rental flats, total rent of the flat",
                "by_flat": [
                    {
                        "flat": FLAT_LABELS.get(row["room_type"], row["room_type"]),
                        "lower_quartile": round(row["rent_lower_quartile"]),
                        "median": round(row["rent_median"]),
                        "upper_quartile": round(row["rent_upper_quartile"]),
                    }
                    for row in sorted(rows, key=lambda row: str(row["room_type"]))
                ],
            }
        if len(spread) == 1:
            raise ToolError(
                f"No published quartiles for {area}. They exist for the large cities and their "
                "sub-areas."
            )
        spread["note"] = (
            "A quarter of sales or agreements fall below the lower quartile and a quarter above "
            "the upper quartile. No other percentiles and no single-sale minimum or maximum are "
            "published; for a minimum or maximum, report the cheapest and most expensive postal "
            "code areas."
        )
        return spread

    def rank_areas(
        measure: str,
        level: str,
        order: str = "highest",
        years: int = 1,
        room_type: str = "all",
        limit: int = 5,
        within: str | None = None,
    ) -> dict[str, Any]:
        ranking = _ranking(measure, level, room_type)
        by_quarter = semantic_layer.query(
            MetricQuery(
                metrics=(ranking.metric,),
                group_by=("metric_time__quarter",),
                filters=ranking.filters,
            )
        )
        published = [row[0] for row in by_quarter.rows if row[-1] is not None]
        if not published:
            raise ToolError(EMPTY_RESULT_HINT)
        latest = max(published)
        last = _year(latest)
        first = last - max(1, min(years, 10)) + 1
        period = str(last) if first == last else f"{first} to {last}"
        if measure == "rent" and latest.month < 10:
            period += f" (to Q{(latest.month - 1) // 3 + 1})"
        result = semantic_layer.query(
            MetricQuery(
                metrics=(ranking.metric,),
                group_by=ranking.names,
                filters=(
                    *ranking.filters,
                    Filter("metric_time__year", ">=", str(first)),
                    Filter("metric_time__year", "<=", str(last)),
                ),
            )
        )
        keys = [
            "postal_code" if name == "postal_area" else name.split("__")[-1]
            for name in ranking.names
        ]
        rows = [
            {**dict(zip(keys, row[:-1], strict=True)), "value": row[-1]}
            for row in result.rows
            if row[-1] is not None
        ]
        if within:
            place = within.strip().lower()
            rows = [
                row
                for row in rows
                if str(row.get("municipality_name") or row.get("area_name"))
                .lower()
                .startswith(place)
            ]
            if not rows:
                raise ToolError(f"No {level} areas with published data in {within}.")
        rows.sort(key=lambda row: row["value"], reverse=order == "highest")

        def money(value: float) -> float:
            return round(value) if measure == "price" else round(value, 2)

        for row in rows:
            row["value"] = money(row["value"])
        median = money(statistics.median(row["value"] for row in rows))
        other_end = dict(rows[-1])
        shown = rows[: max(1, min(limit, MAX_RANKED))]
        for position, row in enumerate(shown):
            following = rows[position + 1] if position + 1 < len(rows) else None
            row["difference_to_next"] = (
                money(row["value"] - following["value"]) if following else None
            )
            row["difference_to_other_end"] = money(row["value"] - other_end["value"])
            row["percent_vs_median"] = round((row["value"] / median - 1) * 100, 1)
        return {
            "measure": ranking.description,
            "unit": ranking.unit,
            "level": level,
            "flat": FLAT_LABELS[room_type],
            "period": period,
            "ranked_among": f"{len(rows)} areas with published data"
            + (f" in {within}" if within else " in Finland"),
            "median_of_areas": median,
            "other_end": other_end,
            "rows": shown,
        }

    string_list = {"type": "array", "items": {"type": "string"}}
    filter_list = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "field": {"type": "string"},
                "operator": {"type": "string", "enum": ["=", "!=", ">", ">=", "<", "<=", "in"]},
                "value": {"type": ["string", "number", "array"], "items": {"type": "string"}},
            },
            "required": ["field", "operator", "value"],
            "additionalProperties": False,
        },
    }
    return [
        Tool(
            name="list_metrics",
            description="List the governed metrics with their definitions.",
            parameters={"type": "object", "properties": {}},
            handler=list_metrics,
        ),
        Tool(
            name="list_dimensions",
            description=(
                "List the entities, dimensions and time grains the given metrics can be grouped by "
                "and filtered on."
            ),
            parameters={
                "type": "object",
                "properties": {"metrics": string_list},
                "required": ["metrics"],
            },
            handler=list_dimensions,
        ),
        Tool(
            name="list_dimension_values",
            description=(
                "Allowed values of a dimension or time grain for the given metrics, for example "
                "dwelling_price__building_type or metric_time__quarter."
            ),
            parameters={
                "type": "object",
                "properties": {"metrics": string_list, "dimension": {"type": "string"}},
                "required": ["metrics", "dimension"],
            },
            handler=list_dimension_values,
        ),
        Tool(
            name="search_areas",
            description=(
                "Find area keys (price areas, rent areas, municipalities, housing finance areas) "
                "and postal codes by name or code, for example 'Helsinki' or 'Kallio'."
            ),
            parameters={
                "type": "object",
                "properties": {"text": {"type": "string"}},
                "required": ["text"],
            },
            handler=search_areas,
        ),
        Tool(
            name="query_metrics",
            description=(
                "Query governed metrics. `group_by` takes names from list_dimensions, for example "
                "metric_time__quarter or postal_area__municipality_name. `order_by` takes "
                "metric or dimension names; put '-' in front for highest first, for example "
                "['-avg_price_per_m2_annual'], and use `limit` for the top rows. " + FILTER_GUIDE
            ),
            parameters={
                "type": "object",
                "properties": {
                    "metrics": string_list,
                    "group_by": string_list,
                    "filters": filter_list,
                    "order_by": string_list,
                    "limit": {"type": "integer"},
                },
                "required": ["metrics"],
            },
            handler=query_metrics,
        ),
        Tool(
            name="area_prices",
            description=(
                "Latest price per m² and monthly rent per m² of flats in a postal code, by room "
                "type (one_room is a studio), with the area level and period each figure comes "
                "from. Only for the latest figures: when the question names a year or quarter, "
                "use query_metrics for that period."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "postal_code": {"type": "string", "description": "Five-digit postal code."}
                },
                "required": ["postal_code"],
            },
            handler=area_prices,
        ),
        Tool(
            name="flat_costs",
            description=(
                "Monthly rent and purchase price of a flat of a given size, or of each size in a "
                "range (for example 50 to 70 m²), from the latest figures of a postal code. Use "
                "it for any question about the total rent or price of a flat of some size."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "postal_code": {"type": "string", "description": "Five-digit postal code."},
                    "room_type": {"type": "string", "enum": ROOM_TYPES},
                    "min_m2": {"type": "number", "description": "Size, or the smallest size."},
                    "max_m2": {"type": ["number", "null"], "description": "Largest size."},
                    "step_m2": {"type": "number", "description": "Step, 1 m² by default."},
                },
                "required": ["postal_code", "room_type", "min_m2"],
            },
            handler=flat_costs,
        ),
        Tool(
            name="price_spread",
            description=(
                "Latest spread of prices per m² and monthly rents in a large city or one of its "
                "price or rent sub-areas: the average, lower quartile, median and upper quartile "
                "by flat type, and for a city its cheapest and most expensive postal code areas."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "area": {
                        "type": "string",
                        "description": "Area key from search_areas, for example price_area:091.",
                    }
                },
                "required": ["area"],
            },
            handler=price_spread,
        ),
        Tool(
            name="rank_areas",
            description=(
                "Rank areas of Finland from the highest or lowest price or rent per m², for "
                "questions such as the most expensive or cheapest area or city. Prices rank by "
                "postal_code or municipality; rents rank by sub_area or municipality. `years` is "
                "the number of latest published years averaged. Each row comes with its "
                "difference to the next area, to the other end of the ranking and to the median "
                "area, for questions about by how much."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "measure": {"type": "string", "enum": ["price", "rent"]},
                    "level": {
                        "type": "string",
                        "enum": ["postal_code", "sub_area", "municipality"],
                    },
                    "order": {"type": "string", "enum": ["highest", "lowest"]},
                    "years": {"type": "integer", "minimum": 1, "maximum": 10},
                    "room_type": {"type": "string", "enum": [*ROOM_TYPES, "all"]},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_RANKED},
                    "within": {
                        "type": "string",
                        "description": "Optional municipality name, to rank the areas inside it.",
                    },
                },
                "required": ["measure", "level", "order"],
            },
            handler=rank_areas,
        ),
    ]


_READ_STATEMENT = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)


def sql_tools(warehouse: Path) -> list[Tool]:
    def describe_marts() -> dict[str, Any]:
        manifest = json.loads((DBT_PROJECT_DIR / "target" / "manifest.json").read_text("utf-8"))
        tables = {}
        for node in manifest["nodes"].values():
            if node["resource_type"] == "model" and node["schema"] == "marts":
                tables[f"marts.{node['name']}"] = {
                    "description": node.get("description", ""),
                    "columns": {
                        name: column.get("description", "")
                        for name, column in node.get("columns", {}).items()
                    },
                }
        return tables

    def run_sql(query: str) -> dict[str, Any]:
        statement = query.strip().rstrip(";")
        if ";" in statement or not _READ_STATEMENT.match(statement):
            raise ToolError("Only a single SELECT statement is allowed.")
        with connect_read_only(warehouse) as connection:
            try:
                cursor = connection.execute(statement)
            except duckdb.Error as error:
                raise ToolError(f"SQL error: {error}") from error
            columns = [column[0] for column in cursor.description]
            rows = cursor.fetchmany(MAX_ROWS + 1)
        return {
            "columns": columns,
            "rows": [[_round(value) for value in row] for row in rows[:MAX_ROWS]],
            "truncated": len(rows) > MAX_ROWS,
        }

    return [
        Tool(
            name="describe_marts",
            description="Tables and columns of the marts schema with their documentation.",
            parameters={"type": "object", "properties": {}},
            handler=describe_marts,
        ),
        Tool(
            name="run_sql",
            description=(
                "Run one read-only DuckDB SELECT statement against the warehouse. Tables live in "
                f"the marts schema. At most {MAX_ROWS} rows are returned."
            ),
            parameters={
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
            handler=run_sql,
        ),
    ]
