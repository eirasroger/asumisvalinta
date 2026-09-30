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
