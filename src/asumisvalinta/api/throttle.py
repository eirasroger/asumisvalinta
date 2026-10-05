"""Minimum time between requests from one client, shared by all API instances through the store."""

import datetime as dt
import hashlib
import hmac
import os

from fastapi import Request

from asumisvalinta.api import store

ASK_INTERVAL_SECONDS = 15
EVENT_INTERVAL_SECONDS = 10


class Unavailable(RuntimeError):
    pass


def client_ip(request: Request) -> str:
    """The caller's address, from the Cloudflare proxy or Cloud Run's X-Forwarded-For."""
    if os.environ.get("ASUMISVALINTA_PROXY_SECRET") and (ip := request.headers.get("x-client-ip")):
        return ip
    if forwarded := request.headers.get("x-forwarded-for"):
        return forwarded.rsplit(",", 1)[-1].strip()
    return request.client.host if request.client else "unknown"


def _client_key(ip: str, scope: str) -> str:
    day = dt.datetime.now(dt.UTC).date().isoformat()
    key = hashlib.sha256(f"{store.secret()}|{day}".encode()).digest()
    return hmac.new(key, f"{scope}|{ip}".encode(), hashlib.sha256).hexdigest()


def allow(ip: str, scope: str, seconds: int) -> bool:
    """Record a request; False if the client's last allowed one was under `seconds` ago."""
    if not store.url():
        return True
    try:
        allowed, _ = store.execute(
            (
                "insert into request_limits (client, last_at) values (?, unixepoch()) "
                "on conflict (client) do update set last_at = excluded.last_at "
                "where request_limits.last_at <= unixepoch() - ? returning 1 as allowed",
                (_client_key(ip, scope), seconds),
            ),
            ("delete from request_limits where last_at < unixepoch() - 86400", ()),
        )
    except Exception as error:
        raise Unavailable("Request limits cannot be checked") from error
    return bool(allowed)
