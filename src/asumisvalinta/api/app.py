"""HTTP API for the web front end: market data, scenarios and the agent."""

import datetime as dt
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi import Path as PathParam
from pydantic import BaseModel, Field

from asumisvalinta.agent import LLMSettings, OpenAIChatModel, semantic_agent
from asumisvalinta.api.limits import LimitReached, QuestionLimits
from asumisvalinta.config import connect_read_only, duckdb_path, load_dotenv
from asumisvalinta.scenario import ScenarioInput, ScenarioResult, simulate
from asumisvalinta.scenario.defaults import load_defaults
from asumisvalinta.scenario.overrides import ScenarioOverrides, apply_overrides
from asumisvalinta.semantic import Filter, MetricQuery, SemanticLayer

RoomType = Literal["one_room", "two_room", "three_room_plus"]
POSTAL_CODE = r"^\d{5}$"
PostalCode = Annotated[str, PathParam(pattern=POSTAL_CODE)]

load_dotenv()
os.environ.setdefault("DBT_LOG_PATH", str(Path(tempfile.gettempdir()) / "dbt-logs"))
app = FastAPI(
    title="Asumisvalinta API",
    description="Rent, right of occupancy or buy in Finland: market data and scenarios.",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
limits = QuestionLimits(
    per_session=int(os.environ.get("ASUMISVALINTA_ASK_SESSION_LIMIT", "10")),
    per_day=int(os.environ.get("ASUMISVALINTA_ASK_DAILY_LIMIT", "200")),
)


def warehouse() -> Path:
    return duckdb_path()


@lru_cache(maxsize=1)
def semantic_layer() -> SemanticLayer:
    return SemanticLayer(warehouse=warehouse())


def _rows(sql: str, params: list[Any]) -> list[dict[str, Any]]:
    with connect_read_only(warehouse()) as connection:
        cursor = connection.execute(sql, params)
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]


def _series(query: MetricQuery) -> list[dict[str, Any]]:
    result = semantic_layer().query(query)
    return [
        {
            "period": row[0].date().isoformat() if isinstance(row[0], dt.datetime) else row[0],
            **{name: value for name, value in zip(result.columns[1:], row[1:], strict=True)},
        }
        for row in result.rows
        if any(value is not None for value in row[1:])
    ]


@app.get("/api/health")
def health() -> dict[str, Any]:
    (as_of,) = _rows("select max(as_of_date) as as_of from marts.mart_market_levels", [])[
        0
    ].values()
    return {"status": "ok", "data_as_of": as_of}


@app.get("/api/postal-areas")
def postal_areas(q: str = Query(min_length=2, max_length=60)) -> list[dict[str, Any]]:
    pattern = f"%{q.strip().lower()}%"
    return _rows(
        "select postal_code, postal_area_name, municipality_name, is_helsinki_metro "
        "from marts.dim_postal_area where postal_code like ? or lower(postal_area_name) like ? "
        "or lower(municipality_name) like ? order by postal_code limit 20",
        [pattern, pattern, pattern],
    )


@app.get("/api/market/{postal_code}")
def market(postal_code: PostalCode) -> dict[str, Any]:
    area = _rows("select * from marts.dim_postal_area where postal_code = ?", [postal_code])
    if not area:
        raise HTTPException(404, f"Unknown postal code {postal_code}")
    levels = _rows(
        "select * exclude (market_level_key) from marts.mart_market_levels "
        "where postal_code = ? order by room_type",
        [postal_code],
    )
    ratios = semantic_layer().query(
        MetricQuery(
            metrics=("price_to_rent_ratio", "gross_rental_yield"),
            group_by=("room_type",),
            filters=(Filter("postal_area", "=", postal_code),),
        )
    )
    by_room = {row[0]: row[1:] for row in ratios.rows}
    for level in levels:
        ratio, gross_yield = by_room.get(level["room_type"], (None, None))
        level["price_to_rent_ratio"], level["gross_rental_yield"] = ratio, gross_yield
    return {"postal_area": area[0], "levels": levels}


@app.get("/api/market/{postal_code}/history")
def market_history(postal_code: PostalCode, room_type: RoomType = "two_room") -> dict[str, Any]:
    level = _rows(
        "select rent_geography_code, rent_geography_level from marts.mart_market_levels "
        "where postal_code = ? and room_type = ?",
        [postal_code, room_type],
    )
    if not level:
        raise HTTPException(404, f"Unknown postal code {postal_code}")
    rent_area = level[0]["rent_geography_code"]
    blocks = Filter("dwelling_price__building_type", "=", "block_of_flats")
    return {
        "prices": _series(
            MetricQuery(
                metrics=("avg_price_per_m2_annual", "avg_price_per_m2"),
                group_by=("metric_time__year",),
                filters=(
                    Filter("postal_area", "=", postal_code),
                    Filter("room_type", "=", room_type),
                    blocks,
                ),
                order_by=("metric_time__year",),
            )
        ),
        "rents": _series(
            MetricQuery(
                metrics=("avg_rent_per_m2_new_contracts", "avg_rent_per_m2"),
                group_by=("metric_time__quarter",),
                filters=(
                    Filter("area", "=", f"rent_area:{rent_area}"),
                    Filter("room_type", "=", room_type),
                ),
                order_by=("metric_time__quarter",),
            )
        ),
        "rents_2015_series": _series(
            MetricQuery(
                metrics=("avg_rent_per_m2_2015_series",),
                group_by=("metric_time__quarter",),
                filters=(
                    Filter("postal_area", "=", postal_code),
                    Filter("room_type", "=", room_type),
                ),
                order_by=("metric_time__quarter",),
            )
        ),
        "rent_area": {"code": rent_area, "level": level[0]["rent_geography_level"]},
    }


@app.get("/api/rates")
def rates(
    since: str = Query(default="2015-01-01", pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> list[dict[str, Any]]:
    return _series(
        MetricQuery(
            metrics=(
                "new_mortgage_rate",
                "new_mortgage_rate_variable",
                "new_mortgage_rate_fixed_1_to_5y",
                "new_mortgage_rate_fixed_over_10y",
            ),
            group_by=("metric_time__month",),
            filters=(Filter("metric_time__month", ">=", since),),
            order_by=("metric_time__month",),
        )
    )


@app.get("/api/metrics")
def metrics() -> list[dict[str, str]]:
    return [
        {"name": m.name, "label": m.label, "description": m.description}
        for m in semantic_layer().list_metrics()
    ]


class ScenarioRequest(BaseModel):
    postal_code: str = Field(pattern=POSTAL_CODE)
    room_type: RoomType
    size_m2: float = Field(gt=0, le=500)
    horizon_years: int = Field(ge=1, le=30)
    overrides: ScenarioOverrides = Field(default_factory=ScenarioOverrides)


@app.post("/api/scenario")
def scenario(request: ScenarioRequest) -> dict[str, Any]:
    try:
        defaults = load_defaults(
            request.postal_code,
            request.room_type,
            request.size_m2,
            request.horizon_years,
            warehouse=warehouse(),
        )
        inputs = apply_overrides(defaults.scenario, request.overrides)
        result = simulate(inputs)
    except LookupError as error:
        raise HTTPException(404, str(error)) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return {
        "inputs": inputs.model_dump(),
        "sources": defaults.sources,
        "result": result.model_dump(),
    }


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    session_id: str = Field(min_length=8, max_length=64)


@lru_cache(maxsize=1)
def _agent():
    return semantic_agent(OpenAIChatModel(LLMSettings.from_env()), warehouse())


@app.post("/api/ask")
def ask(request: AskRequest) -> dict[str, Any]:
    try:
        agent = _agent()
    except RuntimeError as error:
        raise HTTPException(503, "The question service is not configured.") from error
    try:
        limits.take(request.session_id)
    except LimitReached as error:
        raise HTTPException(429, str(error)) from error
    run = agent.run(request.question)
    return {
        "status": run.status if not run.error else "error",
        "answer": run.answer or run.error,
        "value": run.value,
        "unit": run.unit,
        "sources": run.sources,
        "tools_used": [call.tool for call in run.tool_calls if call.tool != "submit_answer"],
        "remaining_questions": limits.remaining(request.session_id),
    }


def _range(q1: float | None, median: float | None, q3: float | None, **context: Any) -> Any:
    if median is None:
        return None
    return {"lower_quartile": q1, "median": median, "upper_quartile": q3, **context}


@app.get("/api/planner/start")
def planner_start(
    postal_code: Annotated[str, Query(pattern=POSTAL_CODE)],
    room_type: RoomType,
    size_m2: Annotated[float, Query(gt=0, le=500)],
    horizon_years: Annotated[int, Query(ge=1, le=30)] = 5,
    building_year: Annotated[int | None, Query(ge=1800, le=2035)] = None,
) -> dict[str, Any]:
    """Default inputs for a flat and the market benchmarks for each of them."""
    try:
        defaults = load_defaults(
            postal_code,
            room_type,
            size_m2,
            horizon_years,
            warehouse=warehouse(),
            building_year=building_year,
        )
    except LookupError as error:
        raise HTTPException(404, str(error)) from error
    level = _rows(
        "select levels.*, postal.postal_area_name, postal.municipality_name "
        "from marts.mart_market_levels as levels "
        "inner join marts.dim_postal_area as postal on levels.postal_code = postal.postal_code "
        "where levels.postal_code = ? and levels.room_type = ?",
        [postal_code, room_type],
    )[0]
    aso = defaults.aso_sample
    return {
        "scenario": defaults.scenario.model_dump(),
        "sources": defaults.sources,
        "rent_growth": {
            "market": defaults.rent_growth_market,
            "lease_clause": defaults.rent_growth_lease_clause,
        },
        "market": {
            "postal_code": postal_code,
            "postal_area_name": level["postal_area_name"],
            "municipality_name": level["municipality_name"],
            "price": {
                "per_m2": level["price_per_m2"],
                "level": level["price_geography_level"],
                "period": level["price_period_label"],
                "preliminary": level["price_is_preliminary"],
                "range_per_m2": _range(
                    level["price_per_m2_lower_quartile"],
                    level["price_per_m2_median"],
                    level["price_per_m2_upper_quartile"],
                    area=level["price_range_area_code"],
                    period=level["price_range_period_label"],
                ),
            },
            "rent": {
                "per_m2": level["rent_per_m2"],
                "level": level["rent_geography_level"],
                "period": level["rent_period_label"],
                "basis": level["rent_basis"],
                "range_monthly": _range(
                    level["rent_lower_quartile"],
                    level["rent_median"],
                    level["rent_upper_quartile"],
                    area=level["rent_range_area_code"],
                    period=level["rent_range_period_label"],
                ),
            },
            "maintenance_charge_per_m2": level["maintenance_charge_per_m2"],
            "aso": {
                "scope": aso.scope,
                "buildings": aso.buildings,
                "fee_per_m2": _range(*aso.fee_per_m2),
                "charge_per_m2": _range(*aso.charge_per_m2),
                "charge_to_rent": aso.charge_to_rent,
                "fee_to_price": aso.fee_to_price,
            },
        },
    }


WHAT_IFS: dict[str, str] = {
    "rates_up": "Interest rates 1 point higher",
    "prices_flat": "Flat prices do not grow",
    "rents_faster": "Rents grow 2 points faster",
    "charges_faster": "Charges rise 2 points faster",
    "savings_lower": "Savings earn 2 points less",
}


def _variant(scenario: ScenarioInput, key: str) -> ScenarioInput:
    data = scenario.model_dump()
    if key == "rates_up":
        data["buy"]["mortgage"]["rate_path"]["start_rate"] += 0.01
        custom = data["buy"]["mortgage"]["rate_path"].get("custom_rates") or ()
        data["buy"]["mortgage"]["rate_path"]["custom_rates"] = [rate + 0.01 for rate in custom]
        if data["buy"]["mortgage"].get("fixed_rate") is not None:
            data["buy"]["mortgage"]["fixed_rate"] += 0.01
    elif key == "prices_flat":
        data["buy"]["price_growth"] = 0.0
    elif key == "rents_faster":
        data["rent"]["rent_growth"] += 0.02
    elif key == "charges_faster":
        data["buy"]["maintenance_charge_growth"] += 0.02
        if data["aso"]:
            data["aso"]["charge_growth"] += 0.02
    elif key == "savings_lower":
        data["investment"]["investment_return"] -= 0.02
        data["investment"]["parked_cash_return"] -= 0.02
    return ScenarioInput.model_validate(data)


@app.post("/api/planner/run")
def planner_run(scenario: ScenarioInput) -> dict[str, Any]:
    """Run the scenario as given, plus what-if variants of it."""
    try:
        result = simulate(scenario)
        what_ifs = []
        for key, label in WHAT_IFS.items():
            variant = simulate(_variant(scenario, key))
            what_ifs.append(
                {
                    "key": key,
                    "label": label,
                    "end_wealth": {o.option: o.end_wealth for o in variant.options},
                    "break_even_years_buy_vs_rent": variant.break_even_years_buy_vs_rent,
                }
            )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return {
        "result": result.model_dump(),
        "monthly_costs": _monthly_costs(result),
        "what_ifs": what_ifs,
    }


def _monthly_costs(result: ScenarioResult) -> list[dict[str, Any]]:
    """Average monthly housing cost of each option in each year of the horizon.

    `buy_repayment` is the part of the buyer's cost that repays loan principal.
    """
    paid = {option.option: option.upfront_payment for option in result.options}
    repaid = 0.0
    rows = []
    for point in result.years[: result.horizon_years]:
        costs = {option: (total - paid[option]) / 12 for option, total in point.total_paid.items()}
        rows.append(
            {"year": point.year, **costs, "buy_repayment": (point.loan_repaid - repaid) / 12}
        )
        paid = dict(point.total_paid)
        repaid = point.loan_repaid
    return rows


@app.get("/api/map/values")
def map_values(room_type: RoomType = "two_room") -> list[dict[str, Any]]:
    """Price, rent and price-to-rent ratio of every postal code, for the map."""
    return _rows(
        "select levels.postal_code, postal.postal_area_name, postal.municipality_code, "
        "postal.municipality_name, levels.price_per_m2, levels.price_geography_level, "
        "levels.rent_per_m2, levels.rent_geography_level, "
        "levels.price_per_m2 / (levels.rent_per_m2 * 12) as price_to_rent_ratio "
        "from marts.mart_market_levels as levels "
        "inner join marts.dim_postal_area as postal on levels.postal_code = postal.postal_code "
        "where levels.room_type = ?",
        [room_type],
    )
