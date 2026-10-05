"""SQL store on Cloudflare D1 (through the store Worker) or a local sqlite:/// file."""

import json
import os
import sqlite3
import urllib.request
from typing import Any

Statement = tuple[str, tuple[Any, ...]]

SCHEMA: tuple[Statement, ...] = (
    (
        "create table if not exists analytics_events (id integer primary key, "
        "created_at integer not null, event_type text not null, payload text not null)",
        (),
    ),
    (
        "create index if not exists analytics_events_created_at on analytics_events (created_at)",
        (),
    ),
    (
        "create table if not exists request_limits "
        "(client text primary key, last_at integer not null)",
        (),
    ),
    (
        "create table if not exists llm_token_usage "
        "(day text primary key, tokens integer not null default 0)",
        (),
    ),
)

_ready: set[str] = set()


def url() -> str | None:
    return os.environ.get("ASUMISVALINTA_STORE_URL") or None


def secret() -> str:
    """Key material for hashing client addresses: the store secret, or the URL of a local file."""
    return os.environ.get("ASUMISVALINTA_STORE_SECRET") or url() or ""


def execute(*statements: Statement) -> list[list[dict[str, Any]]]:
    """Run the statements in one transaction and return the rows of each."""
    target = url()
    if not target:
        raise RuntimeError("ASUMISVALINTA_STORE_URL is not set")
    if target not in _ready:
        _run(target, SCHEMA)
        _ready.add(target)
    return _run(target, statements)


def _run(target: str, statements: tuple[Statement, ...]) -> list[list[dict[str, Any]]]:
    if target.startswith("sqlite:///"):
        return _sqlite(target.removeprefix("sqlite:///"), statements)
    return _worker(target, statements)


def _sqlite(path: str, statements: tuple[Statement, ...]) -> list[list[dict[str, Any]]]:
    connection = sqlite3.connect(path, isolation_level=None, timeout=5)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("begin")
        results = [
            [dict(row) for row in connection.execute(sql, params)] for sql, params in statements
        ]
        connection.execute("commit")
        return results
    except Exception:
        connection.execute("rollback")
        raise
    finally:
        connection.close()


def _worker(target: str, statements: tuple[Statement, ...]) -> list[list[dict[str, Any]]]:
    body = json.dumps(
        {"statements": [{"sql": sql, "params": list(params)} for sql, params in statements]}
    ).encode()
    request = urllib.request.Request(
        target,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "asumisvalinta-api",
            "x-store-secret": os.environ.get("ASUMISVALINTA_STORE_SECRET", ""),
        },
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)["results"]
