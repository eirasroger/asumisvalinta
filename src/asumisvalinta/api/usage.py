"""Daily cap on language model tokens, shared by all API instances through Postgres.

Days are UTC days. Without a database the cap is not enforced (local development). When a
database is configured but cannot be reached, questions are refused so spending stays capped.
"""

import logging
import os

import psycopg

from asumisvalinta.api.analytics import database_url

log = logging.getLogger(__name__)

DEFAULT_DAILY_LIMIT = 2_000_000

_SCHEMA = """
create table if not exists llm_token_usage (
    day date primary key,
    tokens bigint not null default 0
)
"""
_TODAY = "(now() at time zone 'utc')::date"


class BudgetExhausted(RuntimeError):
    pass


class BudgetUnavailable(RuntimeError):
    pass


def daily_limit() -> int:
    return int(os.environ.get("ASUMISVALINTA_LLM_DAILY_TOKEN_LIMIT", DEFAULT_DAILY_LIMIT))


def check() -> None:
    """Raise when today's tokens reached the limit or cannot be counted."""
    url = database_url()
    if not url:
        return
    try:
        with psycopg.connect(url, connect_timeout=5, autocommit=True) as connection:
            connection.execute(_SCHEMA)
            row = connection.execute(
                f"select tokens from llm_token_usage where day = {_TODAY}"
            ).fetchone()
    except Exception as error:
        raise BudgetUnavailable("Token usage cannot be checked") from error
    if row and row[0] >= daily_limit():
        raise BudgetExhausted("The daily token limit is reached")


def add(tokens: int) -> None:
    """Add tokens to today's total; failures are logged."""
    url = database_url()
    if not url or tokens <= 0:
        return
    try:
        with psycopg.connect(url, connect_timeout=5, autocommit=True) as connection:
            connection.execute(_SCHEMA)
            connection.execute(
                f"insert into llm_token_usage (day, tokens) values ({_TODAY}, %s) "
                "on conflict (day) do update set tokens = llm_token_usage.tokens + excluded.tokens",
                (tokens,),
            )
    except Exception:
        log.warning("Could not record %s tokens", tokens, exc_info=True)
