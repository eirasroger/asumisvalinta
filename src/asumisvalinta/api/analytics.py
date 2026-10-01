"""Anonymous usage events stored in Postgres.

Events carry no IP address, cookie or other identifier. Question text is scrubbed of
email addresses, phone numbers, personal identity codes and bank account numbers.
Events older than the retention period are deleted, and at most a daily limit of events
is stored per UTC day. Recording is off when no database URL is configured, and a
failure never affects the request that triggered it.
"""

import json
import logging
import os
import re
from typing import Any

import psycopg

log = logging.getLogger(__name__)

RETENTION_DAYS = 365
DEFAULT_DAILY_LIMIT = 20_000
PHONE_MIN_DIGITS = 9

_REDACTIONS = (
    (re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+"), "[email]"),
    (re.compile(r"\bFI\d{2}(?:\s?\d{4}){3}\s?\d{2}\b", re.IGNORECASE), "[account]"),
    (re.compile(r"\b\d{6}[-+A-FU-Y]\d{3}[0-9A-Y]\b"), "[id]"),
)
_DIGIT_RUN = re.compile(r"(?<!\w)\+?\d[\d\s-]*\d(?!\w)")

_SCHEMA = """
create table if not exists analytics_events (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    event_type text not null,
    payload jsonb not null
);
create index if not exists analytics_events_created_at on analytics_events (created_at);
"""


def _phone(match: re.Match[str]) -> str:
    digits = sum(character.isdigit() for character in match.group())
    return "[phone]" if digits >= PHONE_MIN_DIGITS else match.group()


def redact(text: str) -> str:
    """Replace personal details that people sometimes type into a question."""
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return _DIGIT_RUN.sub(_phone, text)


def daily_limit() -> int:
    return int(os.environ.get("ASUMISVALINTA_EVENTS_DAILY_LIMIT", DEFAULT_DAILY_LIMIT))


def database_url() -> str | None:
    return os.environ.get("ASUMISVALINTA_ANALYTICS_DATABASE_URL") or os.environ.get("DATABASE_URL")


def record(event_type: str, payload: dict[str, Any]) -> None:
    """Store one event; does nothing without a database and never raises."""
    url = database_url()
    if not url:
        return
    try:
        with psycopg.connect(url, connect_timeout=5, autocommit=True) as connection:
            connection.execute(_SCHEMA)
            connection.execute(
                "insert into analytics_events (event_type, payload) select %s, %s::jsonb "
                "where (select count(*) from analytics_events where created_at >= "
                "(now() at time zone 'utc')::date::timestamp at time zone 'utc') < %s",
                (event_type, json.dumps(payload), daily_limit()),
            )
            connection.execute(
                "delete from analytics_events where created_at < now() - make_interval(days => %s)",
                (RETENTION_DAYS,),
            )
    except Exception:  # analytics must never break the app
        log.warning("Could not record a %s event", event_type, exc_info=True)
