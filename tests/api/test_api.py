"""HTTP API against the fixture warehouse."""

import pytest
from fastapi.testclient import TestClient

from tests.warehouse import WAREHOUSE, requires_warehouse

pytestmark = requires_warehouse


@pytest.fixture(scope="module")
def client(monkeypatch_module):
    # Empty values stop .env from supplying a real key: the tests never call a paid API.
    monkeypatch_module.setenv("ASUMISVALINTA_DUCKDB_PATH", str(WAREHOUSE))
    monkeypatch_module.setenv("ASUMISVALINTA_LLM_API_KEY", "")
    monkeypatch_module.setenv("OPENAI_API_KEY", "")
    from asumisvalinta.api import app as api_module

    api_module.semantic_layer.cache_clear()
    api_module._agent.cache_clear()
    return TestClient(api_module.app)


@pytest.fixture(scope="module")
def monkeypatch_module():
    with pytest.MonkeyPatch.context() as patch:
        yield patch


def test_health_reports_the_data_date(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["data_as_of"] == "2026-04-01"


def test_postal_area_search(client):
    areas = client.get("/api/postal-areas", params={"q": "00100"}).json()
    assert areas[0]["postal_code"] == "00100"
    assert areas[0]["municipality_name"] == "Helsinki"


def test_market_levels_include_ratios(client):
    body = client.get("/api/market/00100").json()
    two_room = next(level for level in body["levels"] if level["room_type"] == "two_room")
    assert two_room["price_per_m2"] == 7167
    assert two_room["price_to_rent_ratio"] == pytest.approx(7167 / (25.14 * 12))


def test_invalid_postal_code_is_rejected(client):
    assert client.get("/api/market/123").status_code == 422
    assert client.get("/api/market/12345").status_code == 404


def test_market_history(client):
    body = client.get("/api/market/00100/history", params={"room_type": "two_room"}).json()
    assert body["rent_area"] == {"code": "091_1", "level": "rent_sub_area"}
    assert any(point["period"] == "2025-01-01" for point in body["prices"])
    assert body["rents"][0]["avg_rent_per_m2_new_contracts"] is not None


def test_scenario_with_overrides(client):
    request = {
        "postal_code": "00100",
        "room_type": "two_room",
        "size_m2": 55,
        "horizon_years": 5,
        "overrides": {"interest_rate": 0.05},
    }
    body = client.post("/api/scenario", json=request).json()
    assert body["inputs"]["buy"]["mortgage"]["rate_path"]["start_rate"] == 0.05
    assert body["inputs"]["buy"]["mortgage"]["fixed_rate"] == 0.05
    assert {option["option"] for option in body["result"]["options"]} == {"buy", "rent", "aso"}
    assert len(body["result"]["years"]) == 30


def test_scenario_rejects_unknown_overrides(client):
    request = {
        "postal_code": "00100",
        "room_type": "two_room",
        "size_m2": 55,
        "horizon_years": 5,
        "overrides": {"crime_rate": 1},
    }
    assert client.post("/api/scenario", json=request).status_code == 422


def test_ask_without_a_configured_model_is_unavailable(client):
    response = client.post(
        "/api/ask", json={"question": "Price in 00100?", "session_id": "session-1"}
    )
    assert response.status_code == 503


def test_question_limits():
    from asumisvalinta.api.limits import LimitReached, QuestionLimits

    limits = QuestionLimits(per_session=2, per_day=3)
    limits.take("a")
    limits.take("a")
    with pytest.raises(LimitReached):
        limits.take("a")
    limits.take("b")
    with pytest.raises(LimitReached):
        limits.take("c")
    assert limits.remaining("b") == 0


def test_planner_start_returns_inputs_and_benchmarks(client):
    body = client.get(
        "/api/planner/start",
        params={
            "postal_code": "00100",
            "room_type": "two_room",
            "size_m2": 55,
            "building_year": 1995,
        },
    ).json()
    market = body["market"]
    assert body["scenario"]["size_m2"] == 55
    assert market["price"]["per_m2"] == 7167
    assert market["rent"]["range_monthly"]["area"] == "091_1"
    assert (
        market["rent"]["range_monthly"]["lower_quartile"]
        <= market["rent"]["range_monthly"]["median"]
    )
    assert "1995" in market["aso"]["scope"]


def test_planner_start_without_ranges_outside_large_cities(client):
    body = client.get(
        "/api/planner/start",
        params={"postal_code": "99990", "room_type": "two_room", "size_m2": 55},
    ).json()
    assert body["market"]["rent"]["range_monthly"] is None


def test_planner_run_returns_result_and_what_ifs(client):
    start = client.get(
        "/api/planner/start",
        params={"postal_code": "00100", "room_type": "two_room", "size_m2": 55},
    ).json()
    body = client.post("/api/planner/run", json=start["scenario"]).json()
    assert {o["option"] for o in body["result"]["options"]} == {"buy", "rent", "aso"}
    keys = {w["key"] for w in body["what_ifs"]}
    assert keys == {"rates_up", "prices_flat", "rents_faster", "charges_faster", "savings_lower"}
    base = {o["option"]: o["end_wealth"] for o in body["result"]["options"]}
    rates_up = next(w for w in body["what_ifs"] if w["key"] == "rates_up")
    assert rates_up["end_wealth"]["buy"] < base["buy"]
    costs = body["monthly_costs"]
    assert [row["year"] for row in costs] == list(range(1, start["scenario"]["horizon_years"] + 1))
    rent = start["scenario"]["rent"]["rent_per_m2_month"] * start["scenario"]["size_m2"]
    assert costs[0]["rent"] == pytest.approx(rent)


def test_planner_run_rejects_invalid_inputs(client):
    start = client.get(
        "/api/planner/start",
        params={"postal_code": "00100", "room_type": "two_room", "size_m2": 55},
    ).json()
    scenario = start["scenario"] | {"size_m2": -5}
    assert client.post("/api/planner/run", json=scenario).status_code == 422


def test_map_values_cover_every_postal_code(client):
    rows = client.get("/api/map/values", params={"room_type": "two_room"}).json()
    assert len(rows) == 3018
    row = next(r for r in rows if r["postal_code"] == "00100")
    assert row["price_to_rent_ratio"] == pytest.approx(7167 / (25.14 * 12))
    assert row["municipality_name"] == "Helsinki"


def test_map_trends_match_the_area_history(client):
    trends = client.get("/api/map/trends", params={"room_type": "two_room"}).json()
    history = client.get("/api/market/00100/history", params={"room_type": "two_room"}).json()
    published = {
        int(point["period"][:4]): round(point["avg_price_per_m2_annual"])
        for point in history["prices"]
        if point.get("avg_price_per_m2_annual") is not None
    }
    series = dict(zip(trends["years"], trends["prices"]["00100"], strict=True))
    assert published
    assert {year: series[year] for year in published} == published
