import io
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from asumisvalinta.api import analytics
from asumisvalinta.api.app import app


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Mail me at matti.meikalainen@example.fi", "Mail me at [email]"),
        ("Call +358 40 123 4567 tomorrow", "Call [phone] tomorrow"),
        ("My code is 131052-308T", "My code is [id]"),
        ("Pay to FI21 1234 5600 0007 85", "Pay to [account]"),
        (
            "Rent for 00100 in 2025 for a 1 200 000 € flat?",
            "Rent for 00100 in 2025 for a 1 200 000 € flat?",
        ),
    ],
)
def test_redact(question, expected):
    assert analytics.redact(question) == expected


def test_record_does_nothing_without_a_database(monkeypatch):
    monkeypatch.delenv("ASUMISVALINTA_STORE_URL", raising=False)
    analytics.record("area", {"postal_code": "00100"})


@pytest.fixture
def recorded(monkeypatch):
    monkeypatch.delenv("ASUMISVALINTA_STORE_URL", raising=False)
    events = []
    monkeypatch.setattr(analytics, "record", lambda kind, payload: events.append((kind, payload)))
    return events


SCENARIO = {
    "size_m2": 50,
    "horizon_years": 1,
    "buy": {
        "price_per_m2": 4_000,
        "price_growth": 0.0,
        "maintenance_charge_per_m2_month": 5,
        "maintenance_charge_growth": 0.0,
        "selling_cost_rate": 0.04,
        "mortgage": {
            "down_payment_share": 0.10,
            "term_years": 10,
            "repayment": "equal_principal",
            "rate_path": {"kind": "flat", "start_rate": 0.0},
        },
    },
    "rent": {"rent_per_m2_month": 20, "rent_growth": 0.0},
    "aso": {
        "fee_per_m2": 400,
        "charge_per_m2_month": 15,
        "charge_growth": 0.0,
        "building_cost_index_growth": 0.0,
    },
    "investment": {"investment_return": 0.0, "parked_cash_return": 0.0},
    "policy": {
        "transfer_tax_rate": 0.015,
        "capital_income_tax_rate": 0.30,
        "interest_tax_at_source_rate": 0.30,
        "home_sale_exemption_min_years": 2,
        "presumptive_acquisition_cost_rate_short": 0.20,
        "presumptive_acquisition_cost_rate_long": 0.40,
        "presumptive_acquisition_cost_threshold_years": 10,
        "presumptive_acquisition_cost_rate_securities_short": 0.20,
        "presumptive_acquisition_cost_rate_securities_long": 0.40,
        "max_loan_to_collateral": 0.95,
        "asp_interest_subsidy_threshold_rate": 0.038,
        "asp_interest_subsidy_share": 0.70,
        "asp_interest_subsidy_max_years": 10,
        "asp_min_savings_share": 0.10,
        "asp_loan_max": 230_000,
    },
}
FLAT = {"postal_code": "00100", "room_type": "two_room", "building_year": 1990}


def test_comparison_runs_are_recorded(recorded):
    response = TestClient(app).post("/api/planner/run", params=FLAT, json=SCENARIO)
    assert response.status_code == 200
    ((kind, payload),) = recorded
    assert kind == "scenario"
    assert {key: payload[key] for key in FLAT} == FLAT
    assert payload["scenario"]["rent"]["rent_per_m2_month"] == 20
    assert set(payload["end_wealth"]) == {"buy", "rent", "aso"}
    assert payload["best_option"] in payload["end_wealth"]


def test_runs_without_the_flat_are_not_recorded(recorded):
    assert TestClient(app).post("/api/planner/run", json=SCENARIO).status_code == 200
    assert recorded == []


@pytest.mark.parametrize("header", [{"Sec-GPC": "1"}, {"DNT": "1"}])
def test_runs_are_not_recorded_when_the_browser_opts_out(recorded, header):
    response = TestClient(app).post("/api/planner/run", params=FLAT, json=SCENARIO, headers=header)
    assert response.status_code == 200
    assert recorded == []


def test_frequent_runs_are_dropped(monkeypatch, recorded):
    from asumisvalinta.api import throttle

    monkeypatch.setattr(throttle, "allow", lambda ip, scope, seconds: False)
    assert TestClient(app).post("/api/planner/run", params=FLAT, json=SCENARIO).status_code == 200
    assert recorded == []


@pytest.fixture
def store_file(tmp_path, monkeypatch):
    path = tmp_path / "store.db"
    monkeypatch.setenv("ASUMISVALINTA_STORE_URL", f"sqlite:///{path}")
    monkeypatch.delenv("ASUMISVALINTA_STORE_SECRET", raising=False)
    return path


UNREACHABLE_STORE = "http://127.0.0.1:1/store"


def test_record_writes_to_the_store_and_expires_old_events(store_file):
    analytics.record("area", {"postal_code": "00100"})
    with sqlite3.connect(store_file) as connection:
        kind, payload = connection.execute(
            "select event_type, payload from analytics_events order by id desc limit 1"
        ).fetchone()
        assert (kind, json.loads(payload)) == ("area", {"postal_code": "00100"})
        connection.execute(
            "insert into analytics_events (created_at, event_type, payload) "
            "values (unixepoch('now', '-400 days'), 'area', '{}')"
        )
    analytics.record("area", {"postal_code": "00130"})
    with sqlite3.connect(store_file) as connection:
        oldest, cutoff = connection.execute(
            "select min(created_at), unixepoch('now', '-366 days') from analytics_events"
        ).fetchone()
    assert oldest > cutoff


def test_the_store_worker_receives_the_statements_and_the_secret(monkeypatch):
    from asumisvalinta.api import store

    sent = []

    def urlopen(request, timeout):
        sent.append(request)
        return io.BytesIO(json.dumps({"results": [[], [{"tokens": 5}]]}).encode())

    monkeypatch.setenv("ASUMISVALINTA_STORE_URL", "https://store.example.test")
    monkeypatch.setenv("ASUMISVALINTA_STORE_SECRET", "store-secret")
    monkeypatch.setattr(store.urllib.request, "urlopen", urlopen)
    store._ready.add("https://store.example.test")
    rows = store.execute(("select 1", ()), ("select tokens from t where day = ?", ("d",)))
    assert rows == [[], [{"tokens": 5}]]
    assert sent[0].get_header("X-store-secret") == "store-secret"
    assert json.loads(sent[0].data)["statements"][1] == {
        "sql": "select tokens from t where day = ?",
        "params": ["d"],
    }


class _FakeRun:
    status = "answered"
    error = None
    answer = "About 25 € per m²."
    value = 25.0
    unit = "EUR/m2"
    sources = "Statistics Finland"
    chart = None
    tool_calls = ()
    prompt_tokens = 900
    completion_tokens = 100


class _FakeAgent:
    def run(self, question, history=()):
        return _FakeRun()


def test_questions_are_recorded_redacted_unless_the_browser_opts_out(monkeypatch, recorded):
    from asumisvalinta.api import app as app_module

    monkeypatch.setattr(app_module, "_agent", lambda: _FakeAgent())
    client = TestClient(app)
    question = {
        "question": "Rent in 00100? Reply to a@b.fi",
        "session_id": "session-123",
        "consent": True,
    }
    assert client.post("/api/ask", json=question).status_code == 200
    assert recorded == [
        (
            "question",
            {
                "question": "Rent in 00100? Reply to [email]",
                "status": "answered",
                "tools": [],
                "turn": 1,
                "visit": None,
            },
        )
    ]
    assert client.post("/api/ask", json={**question, "record": False}).status_code == 200
    assert len(recorded) == 1


def test_reads_are_cached_and_writes_are_not(recorded):
    client = TestClient(app)
    assert "s-maxage" in client.get("/api/health").headers["cache-control"]
    assert "cache-control" not in client.post("/api/planner/run", json=SCENARIO).headers


def test_questions_are_refused_once_the_daily_tokens_are_used(monkeypatch, recorded):
    from asumisvalinta.api import app as app_module
    from asumisvalinta.api import usage

    asked = []

    class _CountingAgent(_FakeAgent):
        def run(self, question, history=()):
            asked.append(question)
            return super().run(question, history)

    def exhausted():
        raise usage.BudgetExhausted("limit")

    monkeypatch.setattr(app_module, "_agent", lambda: _CountingAgent())
    monkeypatch.setattr(usage, "check", exhausted)
    client = TestClient(app)
    response = client.post(
        "/api/ask", json={"question": "Rent in 00100?", "session_id": "session-9", "consent": True}
    )
    assert response.status_code == 429
    assert asked == []


def test_daily_token_budget(store_file, monkeypatch):
    from asumisvalinta.api import usage

    monkeypatch.setenv("ASUMISVALINTA_LLM_DAILY_TOKEN_LIMIT", "1000")
    usage.check()
    usage.add(600)
    usage.check()
    usage.add(600)
    with pytest.raises(usage.BudgetExhausted):
        usage.check()


def test_unreachable_database_refuses_questions(monkeypatch):
    from asumisvalinta.api import usage

    monkeypatch.setenv("ASUMISVALINTA_STORE_URL", UNREACHABLE_STORE)
    with pytest.raises(usage.BudgetUnavailable):
        usage.check()


VISIT = "3f2b8c1e-9a4d-4c6b-8e2f-1a2b3c4d5e6f"


def test_questions_keep_the_visit_number(monkeypatch, recorded):
    from asumisvalinta.api import app as app_module

    monkeypatch.setattr(app_module, "_agent", lambda: _FakeAgent())
    client = TestClient(app)
    question = {
        "question": "Rent in 00100?",
        "session_id": "session-77",
        "visit": VISIT,
        "consent": True,
    }
    assert client.post("/api/ask", json=question).status_code == 200
    assert recorded[0][1]["visit"] == VISIT


def test_questions_must_wait_between_calls(monkeypatch, recorded):
    from asumisvalinta.api import app as app_module
    from asumisvalinta.api import throttle

    calls = []
    monkeypatch.setattr(app_module, "_agent", lambda: _FakeAgent())
    monkeypatch.setattr(throttle, "allow", lambda ip, scope, seconds: calls.append(ip) and False)
    client = TestClient(app)
    response = client.post(
        "/api/ask",
        json={"question": "Rent in 00100?", "session_id": "session-5", "consent": True},
        headers={"x-forwarded-for": "10.0.0.1, 203.0.113.7"},
    )
    assert response.status_code == 429
    assert response.headers["retry-after"] == "15"
    assert calls == ["203.0.113.7"]
    assert recorded == []


def test_unreachable_database_pauses_questions(monkeypatch, recorded):
    from asumisvalinta.api import app as app_module

    monkeypatch.setattr(app_module, "_agent", lambda: _FakeAgent())
    monkeypatch.setenv("ASUMISVALINTA_STORE_URL", UNREACHABLE_STORE)
    response = TestClient(app).post(
        "/api/ask", json={"question": "Rent in 00100?", "session_id": "session-6", "consent": True}
    )
    assert response.status_code == 503


def test_request_limits(store_file):
    from asumisvalinta.api import throttle

    assert throttle.allow("203.0.113.7", "ask", 15)
    assert not throttle.allow("203.0.113.7", "ask", 15)
    assert throttle.allow("203.0.113.8", "ask", 15)
    assert throttle.allow("203.0.113.7", "event:area", 10)
    with sqlite3.connect(store_file) as connection:
        stored = [row[0] for row in connection.execute("select client from request_limits")]
        connection.execute("update request_limits set last_at = unixepoch() - 20")
    assert not any("203.0.113" in client for client in stored)
    assert throttle.allow("203.0.113.7", "ask", 15)


def test_events_stop_at_the_daily_limit(store_file, monkeypatch):
    monkeypatch.setenv("ASUMISVALINTA_EVENTS_DAILY_LIMIT", "2")
    for code in ("00100", "00120", "00130"):
        analytics.record("area", {"postal_code": code})
    with sqlite3.connect(store_file) as connection:
        assert connection.execute("select count(*) from analytics_events").fetchone()[0] == 2


def test_the_website_may_call_the_api_from_its_own_origin():
    client = TestClient(app)
    preflight = client.options(
        "/api/planner/run",
        headers={
            "Origin": "https://asumisvalinta.fi",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "https://asumisvalinta.fi"
    other = client.options(
        "/api/planner/run",
        headers={"Origin": "https://example.com", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in other.headers


def test_client_ip_is_the_address_the_platform_appended():
    from starlette.requests import Request

    from asumisvalinta.api.throttle import client_ip

    def request(headers: dict[str, str]) -> Request:
        raw = [(key.encode(), value.encode()) for key, value in headers.items()]
        return Request({"type": "http", "headers": raw, "client": ("10.1.2.3", 1234)})

    assert client_ip(request({"x-forwarded-for": "198.51.100.9, 203.0.113.7"})) == "203.0.113.7"
    assert client_ip(request({"x-forwarded-for": "203.0.113.7"})) == "203.0.113.7"
    assert client_ip(request({})) == "10.1.2.3"


def test_large_bodies_are_refused_before_they_are_read(recorded):
    client = TestClient(app)
    response = client.post("/api/planner/run", content="a" * (65 * 1024))
    assert response.status_code == 413
    assert recorded == []


def test_api_documentation_is_not_published():
    client = TestClient(app)
    assert client.get("/api/docs").status_code == 404
    assert client.get("/api/openapi.json").status_code == 404


def test_only_the_proxy_may_call_the_api_when_a_secret_is_set(monkeypatch):
    monkeypatch.setenv("ASUMISVALINTA_PROXY_SECRET", "proxy-secret")
    client = TestClient(app)
    assert client.get("/api/rates").status_code == 403
    assert client.get("/api/rates", headers={"x-proxy-secret": "wrong"}).status_code == 403
    response = client.options(
        "/api/planner/run",
        headers={
            "x-proxy-secret": "proxy-secret",
            "Origin": "https://asumisvalinta.fi",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200


def test_client_ip_comes_from_the_proxy_when_a_secret_is_set(monkeypatch):
    from starlette.requests import Request

    from asumisvalinta.api.throttle import client_ip

    monkeypatch.setenv("ASUMISVALINTA_PROXY_SECRET", "proxy-secret")
    headers = [(b"x-client-ip", b"198.51.100.4"), (b"x-forwarded-for", b"104.28.0.1")]
    request = Request({"type": "http", "headers": headers, "client": ("10.1.2.3", 1234)})
    assert client_ip(request) == "198.51.100.4"
