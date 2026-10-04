import os

import psycopg
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
    monkeypatch.delenv("ASUMISVALINTA_ANALYTICS_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    analytics.record("area", {"postal_code": "00100"})


@pytest.fixture
def recorded(monkeypatch):
    monkeypatch.delenv("ASUMISVALINTA_ANALYTICS_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
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


POSTGRES = os.environ.get("ASUMISVALINTA_ANALYTICS_TEST_DATABASE_URL")


@pytest.mark.skipif(not POSTGRES, reason="needs a Postgres test database")
def test_record_writes_to_postgres_and_expires_old_events(monkeypatch):
    monkeypatch.setenv("ASUMISVALINTA_ANALYTICS_DATABASE_URL", POSTGRES)
    analytics.record("area", {"postal_code": "00100"})
    with psycopg.connect(POSTGRES, autocommit=True) as connection:
        kind, payload = connection.execute(
            "select event_type, payload from analytics_events order by id desc limit 1"
        ).fetchone()
        assert (kind, payload) == ("area", {"postal_code": "00100"})
        connection.execute(
            "insert into analytics_events (created_at, event_type, payload) "
            "values (now() - interval '400 days', 'area', '{}'::jsonb)"
        )
    analytics.record("area", {"postal_code": "00130"})
    with psycopg.connect(POSTGRES) as connection:
        oldest = connection.execute("select min(created_at) from analytics_events").fetchone()[0]
        recent = connection.execute("select now() - interval '366 days'").fetchone()[0]
    assert oldest > recent


class _FakeRun:
    status = "answered"
    error = None
    answer = "About 25 € per m²."
    value = 25.0
    unit = "EUR/m2"
    sources = "Statistics Finland"
    tool_calls = ()
    prompt_tokens = 900
    completion_tokens = 100


class _FakeAgent:
    def run(self, question):
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
        def run(self, question):
            asked.append(question)
            return super().run(question)

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


@pytest.mark.skipif(not POSTGRES, reason="needs a Postgres test database")
def test_daily_token_budget_in_postgres(monkeypatch):
    from asumisvalinta.api import usage

    monkeypatch.setenv("ASUMISVALINTA_ANALYTICS_DATABASE_URL", POSTGRES)
    monkeypatch.setenv("ASUMISVALINTA_LLM_DAILY_TOKEN_LIMIT", "1000")
    with psycopg.connect(POSTGRES, autocommit=True) as connection:
        connection.execute("drop table if exists llm_token_usage")
    usage.check()
    usage.add(600)
    usage.check()
    usage.add(600)
    with pytest.raises(usage.BudgetExhausted):
        usage.check()


def test_unreachable_database_refuses_questions(monkeypatch):
    from asumisvalinta.api import usage

    monkeypatch.setenv(
        "ASUMISVALINTA_ANALYTICS_DATABASE_URL", "postgresql://nobody@127.0.0.1:1/none"
    )
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
        headers={"x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1"},
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
    monkeypatch.setenv(
        "ASUMISVALINTA_ANALYTICS_DATABASE_URL", "postgresql://nobody@127.0.0.1:1/none"
    )
    response = TestClient(app).post(
        "/api/ask", json={"question": "Rent in 00100?", "session_id": "session-6", "consent": True}
    )
    assert response.status_code == 503


@pytest.mark.skipif(not POSTGRES, reason="needs a Postgres test database")
def test_request_limits_in_postgres(monkeypatch):
    from asumisvalinta.api import throttle

    monkeypatch.setenv("ASUMISVALINTA_ANALYTICS_DATABASE_URL", POSTGRES)
    with psycopg.connect(POSTGRES, autocommit=True) as connection:
        connection.execute("drop table if exists request_limits")
    assert throttle.allow("203.0.113.7", "ask", 15)
    assert not throttle.allow("203.0.113.7", "ask", 15)
    assert throttle.allow("203.0.113.8", "ask", 15)
    assert throttle.allow("203.0.113.7", "event:area", 10)
    with psycopg.connect(POSTGRES, autocommit=True) as connection:
        stored = [row[0] for row in connection.execute("select client from request_limits")]
        connection.execute("update request_limits set last_at = now() - interval '20 seconds'")
    assert not any("203.0.113" in client for client in stored)
    assert throttle.allow("203.0.113.7", "ask", 15)


@pytest.mark.skipif(not POSTGRES, reason="needs a Postgres test database")
def test_events_stop_at_the_daily_limit(monkeypatch):
    monkeypatch.setenv("ASUMISVALINTA_ANALYTICS_DATABASE_URL", POSTGRES)
    monkeypatch.setenv("ASUMISVALINTA_EVENTS_DAILY_LIMIT", "2")
    with psycopg.connect(POSTGRES, autocommit=True) as connection:
        connection.execute("drop table if exists analytics_events")
    for code in ("00100", "00120", "00130"):
        analytics.record("area", {"postal_code": code})
    with psycopg.connect(POSTGRES) as connection:
        assert connection.execute("select count(*) from analytics_events").fetchone()[0] == 2
