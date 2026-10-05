"""Anonymous usage events, scrubbed of personal details and kept for a year."""

import json
import logging
import os
import re
from typing import Any

from asumisvalinta.api import store

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


def record(event_type: str, payload: dict[str, Any]) -> None:
    """Store one event; does nothing without a store and never raises."""
    if not store.url():
        return
    try:
        store.execute(
            (
                "insert into analytics_events (created_at, event_type, payload) "
                "select unixepoch(), ?, ? where (select count(*) from analytics_events "
                "where created_at >= unixepoch('now', 'start of day')) < ?",
                (event_type, json.dumps(payload), daily_limit()),
            ),
            (
                "delete from analytics_events where created_at < unixepoch('now', ?)",
                (f"-{RETENTION_DAYS} days",),
            ),
        )
    except Exception:  # analytics must never break the app
        log.warning("Could not record a %s event", event_type, exc_info=True)
