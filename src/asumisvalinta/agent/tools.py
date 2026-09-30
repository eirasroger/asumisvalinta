"""Tools the agents can call. Every tool returns JSON text for the model."""

import datetime as dt
import json
import re
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
ANSWER_TOOL = "submit_answer"

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
                "answer": {"type": "string", "description": "Answer for the user in English."},
                "value": {"type": ["number", "null"], "description": "Main number, if any."},
                "unit": {"type": ["string", "null"]},
                "sources": {
                    "type": "string",
                    "description": "Metrics or tables, periods and geography levels used.",
                },
            },
            "required": ["status", "answer", "value", "unit", "sources"],
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
    "whether the period has published data."
)


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
                "metric_time__quarter or postal_area__municipality_name. " + FILTER_GUIDE
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
