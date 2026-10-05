"""Questions per browser session, kept in memory and cleared daily."""

import datetime as dt
import threading
from dataclasses import dataclass, field


class LimitReached(Exception):
    """A session has used its questions; `kind` names the error text."""

    def __init__(self, kind: str = "session_limit") -> None:
        super().__init__(kind)
        self.kind = kind


@dataclass
class QuestionLimits:
    per_session: int
    _day: dt.date = field(default_factory=dt.date.today)
    _sessions: dict[str, int] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _roll_over(self) -> None:
        today = dt.date.today()
        if today != self._day:
            self._day, self._sessions = today, {}

    def take(self, session_id: str) -> None:
        """Count one question or raise LimitReached."""
        with self._lock:
            self._roll_over()
            if self._sessions.get(session_id, 0) >= self.per_session:
                raise LimitReached()
            self._sessions[session_id] = self._sessions.get(session_id, 0) + 1

    def remaining(self, session_id: str) -> int:
        with self._lock:
            return max(0, self.per_session - self._sessions.get(session_id, 0))
