"""Question limits for the agent endpoint: per browser session and per day.

Counters live in memory, so they reset when an instance restarts and are not
shared between instances. The spending limit set on the model provider's
account is the hard guarantee.
"""

import datetime as dt
import threading
from dataclasses import dataclass, field


class LimitReached(Exception):
    pass


@dataclass
class QuestionLimits:
    per_session: int
    per_day: int
    _day: dt.date = field(default_factory=dt.date.today)
    _today: int = 0
    _sessions: dict[str, int] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def take(self, session_id: str) -> None:
        """Count one question or raise LimitReached."""
        with self._lock:
            today = dt.date.today()
            if today != self._day:
                self._day, self._today, self._sessions = today, 0, {}
            if self._today >= self.per_day:
                raise LimitReached("The daily question limit is reached. Try again tomorrow.")
            if self._sessions.get(session_id, 0) >= self.per_session:
                raise LimitReached("This session has used all its questions.")
            self._today += 1
            self._sessions[session_id] = self._sessions.get(session_id, 0) + 1

    def remaining(self, session_id: str) -> int:
        with self._lock:
            return max(
                0,
                min(
                    self.per_session - self._sessions.get(session_id, 0),
                    self.per_day - self._today,
                ),
            )
