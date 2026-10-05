"""Conversation history kept by the browser; only turns this API signed reach the agent."""

import hashlib
import hmac

from pydantic import BaseModel, Field

from asumisvalinta.api import store

MAX_TURNS = 4
ANSWER_CHARS = 1200


class Turn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    answer: str = Field(max_length=4000)
    signature: str = Field(pattern=r"^[0-9a-f]{64}$")


def _key() -> bytes | None:
    secret = store.secret()
    return hashlib.sha256(f"{secret}|ask-history".encode()).digest() if secret else None


def sign(session_id: str, question: str, answer: str) -> str | None:
    """Signature of one turn; None without a secret, which turns conversation memory off."""
    key = _key()
    if key is None:
        return None
    message = "\n".join((session_id, question, answer)).encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def verified(session_id: str, turns: list[Turn]) -> list[tuple[str, str]]:
    """The last turns this API signed for the session, oldest first, with shortened answers."""
    kept = []
    for turn in turns[-MAX_TURNS:]:
        expected = sign(session_id, turn.question, turn.answer)
        if expected and hmac.compare_digest(expected, turn.signature):
            kept.append((turn.question, turn.answer[:ANSWER_CHARS]))
    return kept
