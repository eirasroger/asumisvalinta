"""Minimum time between requests from one client, shared by all API instances through Postgres."""

import datetime as dt
import hashlib
import hmac

import psycopg
from fastapi import Request

from asumisvalinta.api.analytics import database_url

ASK_INTERVAL_SECONDS = 15
EVENT_INTERVAL_SECONDS = 10

_SCHEMA = """
create table if not exists request_limits (
    client text primary key,
    last_at timestamptz not null
)
"""


class Unavailable(RuntimeError):
    pass


def client_ip(request: Request) -> str:
    """The caller's address as set by Vercel's edge, which overwrites client-supplied values."""
    for header in ("x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"):
        if value := request.headers.get(header):
            return value.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _client_key(ip: str, scope: str, url: str) -> str:
    day = dt.datetime.now(dt.UTC).date().isoformat()
    key = hashlib.sha256(f"{url}|{day}".encode()).digest()
    return hmac.new(key, f"{scope}|{ip}".encode(), hashlib.sha256).hexdigest()


def allow(ip: str, scope: str, seconds: int) -> bool:
    """Record a request and say whether `seconds` passed since the client's last allowed one.

    Raises Unavailable when the database cannot be reached.
    """
    url = database_url()
    if not url:
        return True
    try:
        with psycopg.connect(url, connect_timeout=5, autocommit=True) as connection:
            connection.execute(_SCHEMA)
            allowed = connection.execute(
                "insert into request_limits (client, last_at) values (%s, now()) "
                "on conflict (client) do update set last_at = excluded.last_at "
                "where request_limits.last_at <= now() - make_interval(secs => %s) "
                "returning 1",
                (_client_key(ip, scope, url), seconds),
            ).fetchone()
            if allowed:
                connection.execute(
                    "delete from request_limits where last_at < now() - interval '1 day'"
                )
    except Exception as error:
        raise Unavailable("Request limits cannot be checked") from error
    return allowed is not None
