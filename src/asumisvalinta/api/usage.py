"""Daily cap on language model tokens; questions are refused when the store is unreachable."""

import logging
import os

from asumisvalinta.api import store

log = logging.getLogger(__name__)

DEFAULT_DAILY_LIMIT = 2_000_000


class BudgetExhausted(RuntimeError):
    pass


class BudgetUnavailable(RuntimeError):
    pass


def daily_limit() -> int:
    return int(os.environ.get("ASUMISVALINTA_LLM_DAILY_TOKEN_LIMIT", DEFAULT_DAILY_LIMIT))


def check() -> None:
    """Raise when today's tokens reached the limit or cannot be counted."""
    if not store.url():
        return
    try:
        (rows,) = store.execute(("select tokens from llm_token_usage where day = date('now')", ()))
    except Exception as error:
        raise BudgetUnavailable("Token usage cannot be checked") from error
    if rows and rows[0]["tokens"] >= daily_limit():
        raise BudgetExhausted("The daily token limit is reached")


def add(tokens: int) -> None:
    """Add tokens to today's total; failures are logged."""
    if not store.url() or tokens <= 0:
        return
    try:
        store.execute(
            (
                "insert into llm_token_usage (day, tokens) values (date('now'), ?) "
                "on conflict (day) do update set tokens = llm_token_usage.tokens + excluded.tokens",
                (tokens,),
            )
        )
    except Exception:
        log.warning("Could not record %s tokens", tokens, exc_info=True)
