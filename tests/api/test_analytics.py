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


def test_area_event_is_recorded(recorded):
    client = TestClient(app)
    body = {
        "type": "area",
        "postal_code": "00100",
        "room_type": "two_room",
        "source": "map",
        "metric": "price",
    }
    assert client.post("/api/events", json=body).status_code == 204
    assert recorded == [
        (
            "area",
            {
                "postal_code": "00100",
                "room_type": "two_room",
                "source": "map",
                "metric": "price",
                "visit": None,
            },
        )
    ]


def test_scenario_event_is_recorded(recorded):
    client = TestClient(app)
    body = {
        "type": "scenario",
        "postal_code": "00100",
        "room_type": "two_room",
        "size_m2": 55,
        "building_year": 1990,
        "horizon_years": 5,
        "own_numbers": {"rent": 1450},
        "assumptions": {"surplus_strategy": "invest"},
        "best_option": "aso",
        "end_wealth": {"buy": 107_000, "rent": 100_000, "aso": 113_000},
        "updates": 7,
    }
    assert client.post("/api/events", json=body).status_code == 204
    assert recorded[0][0] == "scenario"
    assert recorded[0][1]["own_numbers"] == {"rent": 1450}
    assert recorded[0][1]["updates"] == 7


def test_events_with_unknown_fields_are_rejected(recorded):
    client = TestClient(app)
    body = {
        "type": "area",
        "postal_code": "00100",
        "room_type": "two_room",
        "source": "map",
        "ip": "1.2.3.4",
    }
    assert client.post("/api/events", json=body).status_code == 422
    assert recorded == []


def test_events_sent_as_plain_text_are_recorded(recorded):
    body = '{"type": "area", "postal_code": "00100", "room_type": "two_room", "source": "map"}'
    response = TestClient(app).post(
        "/api/events", content=body, headers={"Content-Type": "text/plain;charset=UTF-8"}
    )
    assert response.status_code == 204
    assert recorded[0][0] == "area"


def test_malformed_events_are_rejected(recorded):
    response = TestClient(app).post(
        "/api/events", content="not json", headers={"Content-Type": "text/plain"}
    )
    assert response.status_code == 422
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
    body = {"type": "area", "postal_code": "00100", "room_type": "two_room", "source": "map"}
    assert "cache-control" not in client.post("/api/events", json=body).headers


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


def test_events_from_one_visit_share_its_number(recorded):
    client = TestClient(app)
    body = {
        "type": "area",
        "postal_code": "00100",
        "room_type": "two_room",
        "source": "map",
        "visit": VISIT,
    }
    assert client.post("/api/events", json=body).status_code == 204
    assert recorded[0][1]["visit"] == VISIT
    assert client.post("/api/events", json={**body, "visit": "not a visit"}).status_code == 422


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


def test_frequent_events_are_dropped(monkeypatch, recorded):
    from asumisvalinta.api import throttle

    monkeypatch.setattr(throttle, "allow", lambda ip, scope, seconds: False)
    body = {"type": "area", "postal_code": "00100", "room_type": "two_room", "source": "map"}
    assert TestClient(app).post("/api/events", json=body).status_code == 204
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
    response = client.post("/api/events", content="a" * (65 * 1024))
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
