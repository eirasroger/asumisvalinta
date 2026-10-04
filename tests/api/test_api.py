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
        "/api/ask",
        json={"question": "Price in 00100?", "session_id": "session-1", "consent": True},
    )
    assert response.status_code == 503


def test_ask_requires_consent(client):
    question = {"question": "Price in 00100?", "session_id": "session-1"}
    response = client.post("/api/ask", json=question)
    assert response.status_code == 403
    finnish = client.post("/api/ask", params={"lang": "fi"}, json={**question, "consent": False})
    assert "Hyväksy" in finnish.json()["detail"]


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
    # 7167 €/m² for all ages, scaled for a building from the 1990s.
    assert market["price"]["building_age_ratio"] != 1
    assert market["price"]["per_m2"] == pytest.approx(7167 * market["price"]["building_age_ratio"])
    assert body["scenario"]["buy"]["price_per_m2"] == pytest.approx(market["price"]["per_m2"])
    assert market["rent"]["range_monthly"]["area"] == "091_1"
    assert (
        market["rent"]["range_monthly"]["lower_quartile"]
        <= market["rent"]["range_monthly"]["median"]
    )
    assert market["aso"] == {"fee_share_of_price": 0.15, "charge_share_of_rent": 0.85}


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
    what_ifs = {w["key"]: w["end_wealth"] for w in body["what_ifs"]}
    assert set(what_ifs) == {
        "rates_down",
        "rates_up",
        "prices_slower",
        "prices_faster",
        "rents_slower",
        "rents_faster",
        "charges_faster",
        "savings_lower",
        "savings_higher",
    }
    base = {o["option"]: o["end_wealth"] for o in body["result"]["options"]}
    assert what_ifs["rates_up"]["buy"] < base["buy"] < what_ifs["rates_down"]["buy"]
    assert what_ifs["prices_slower"]["buy"] < base["buy"] < what_ifs["prices_faster"]["buy"]
    assert what_ifs["savings_lower"]["rent"] < base["rent"] < what_ifs["savings_higher"]["rent"]
    assert what_ifs["rents_faster"]["rent"] < base["rent"] < what_ifs["rents_slower"]["rent"]
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


def _search(client, q):
    return client.get("/api/postal-areas", params={"q": q}).json()


def test_address_with_number_finds_its_postal_code(client):
    # Mannerheimintie, Helsinki: odd 1-13 and even 2-40 are 00100, odd 17-69 is 00250.
    first = _search(client, "Mannerheimintie 40")[0]
    assert (first["postal_code"], first["municipality_name"]) == ("00100", "Helsinki")
    assert first["street"] == "Mannerheimintie 40"
    assert first["addresses_downloaded_on"]
    assert _search(client, "Mannerheimintie 69")[0]["postal_code"] == "00250"


def test_swedish_names_and_missing_accents_match(client):
    first = _search(client, "mannerheimvagen 40")[0]
    assert (first["postal_code"], first["street"]) == ("00100", "Mannerheimvägen 40")
    assert _search(client, "Hameentie 15")[0]["postal_code"] == "00500"


def test_a_municipality_narrows_a_common_street_name(client):
    everywhere = {r["municipality_name"] for r in _search(client, "Koulukatu") if r.get("street")}
    assert len(everywhere) > 1
    tampere = [r for r in _search(client, "Koulukatu 5 Tampere") if r.get("street")]
    assert tampere and {r["municipality_name"] for r in tampere} == {"Tampere"}


def test_a_number_outside_every_range_lists_the_street_ranges(client):
    results = [r for r in _search(client, "Tikkurilantie 2") if r.get("street")]
    assert "01300" in {r["postal_code"] for r in results}
    assert all(not r["street"].endswith(" 2") for r in results)


def test_postal_code_search_still_returns_areas(client):
    first = _search(client, "00100")[0]
    assert first["postal_code"] == "00100"
    assert "street" not in first


def test_typos_and_accents_still_find_the_street(client):
    assert _search(client, "Hamentie 15")[0]["street"] == "Hämeentie 15"
    assert _search(client, "manerheimintie 40")[0]["postal_code"] == "00100"


def test_area_names_match_without_accents(client):
    assert "00250" in {r["postal_code"] for r in _search(client, "Toolo")}


def test_finnish_text_on_request(client):
    params = {"postal_code": "00100", "room_type": "two_room", "size_m2": 55, "lang": "fi"}
    start = client.get("/api/planner/start", params=params).json()
    assert "Tilastokeskus" in start["sources"]["price_per_m2"]
    assert "9 §" in start["sources"]["aso_fee"]
    run = client.post("/api/planner/run", params={"lang": "fi"}, json=start["scenario"]).json()
    labels = {w["key"]: w["label"] for w in run["what_ifs"]}
    assert labels["rates_up"] == "Korot 1 prosenttiyksikön korkeammat"
    missing = client.get("/api/planner/start", params={**params, "postal_code": "99999"})
    assert missing.status_code == 404
    assert "99999" in missing.json()["detail"]
    assert "lukuja" in missing.json()["detail"]


def test_english_is_the_default_and_other_languages_are_refused(client):
    params = {"postal_code": "00100", "room_type": "two_room", "size_m2": 55}
    start = client.get("/api/planner/start", params=params).json()
    assert "Statistics Finland" in start["sources"]["price_per_m2"]
    assert client.get("/api/planner/start", params={**params, "lang": "de"}).status_code == 422
