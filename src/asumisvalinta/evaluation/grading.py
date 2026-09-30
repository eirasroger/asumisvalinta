"""Grade agent answers against the golden set and summarise the results."""

from dataclasses import asdict, dataclass
from typing import Any

from asumisvalinta.agent import AgentRun
from asumisvalinta.evaluation.golden import GoldenQuestion, Tolerance


@dataclass(frozen=True)
class Grade:
    question_id: str
    kind: str
    agent: str
    expected_status: str
    status: str
    expected_value: float | None
    value: float | None
    correct: bool
    reason: str
    prompt_tokens: int
    completion_tokens: int
    tool_calls: int
    failed_tool_calls: int


def grade(
    question: GoldenQuestion,
    run: AgentRun,
    expected: float | None,
    tolerance: Tolerance,
) -> Grade:
    if run.error:
        correct, reason = False, run.error
    elif run.status != question.expected_status:
        correct, reason = False, f"status {run.status}, expected {question.expected_status}"
    elif expected is None:
        correct, reason = True, "status matches"
    elif run.value is None:
        correct, reason = False, "no numeric value"
    elif tolerance.accepts(expected, float(run.value)):
        correct, reason = True, "within tolerance"
    else:
        correct, reason = False, f"value {run.value}, expected {expected:.4f}"
    return Grade(
        question_id=question.id,
        kind=question.kind,
        agent=run.agent,
        expected_status=question.expected_status,
        status=run.status,
        expected_value=expected,
        value=run.value,
        correct=correct,
        reason=reason,
        prompt_tokens=run.prompt_tokens,
        completion_tokens=run.completion_tokens,
        tool_calls=len(run.tool_calls),
        failed_tool_calls=sum(not call.ok for call in run.tool_calls),
    )


def summarise(grades: list[Grade]) -> dict[str, Any]:
    """Accuracy, refusal handling and token usage per agent."""
    summary: dict[str, Any] = {}
    for agent in sorted({g.agent for g in grades}):
        rows = [g for g in grades if g.agent == agent]
        numeric = [g for g in rows if g.kind in ("metric", "scenario")]
        refusals = [g for g in rows if g.kind == "refusal"]
        clarifications = [g for g in rows if g.kind == "clarification"]
        wrongly_refused = [g for g in numeric if g.status in ("refused", "needs_clarification")]
        summary[agent] = {
            "questions": len(rows),
            "accuracy": _share(rows),
            "accuracy_within_tolerance": _share(numeric),
            "metric_accuracy": _share([g for g in numeric if g.kind == "metric"]),
            "scenario_accuracy": _share([g for g in numeric if g.kind == "scenario"]),
            "correct_refusals": _share(refusals),
            "correct_clarifications": _share(clarifications),
            "answerable_questions_refused": len(wrongly_refused),
            "prompt_tokens": sum(g.prompt_tokens for g in rows),
            "completion_tokens": sum(g.completion_tokens for g in rows),
            "tokens_per_question": round(
                sum(g.prompt_tokens + g.completion_tokens for g in rows) / max(len(rows), 1)
            ),
            "tool_calls_per_question": round(
                sum(g.tool_calls for g in rows) / max(len(rows), 1), 2
            ),
            "failed_tool_calls": sum(g.failed_tool_calls for g in rows),
        }
    return summary


def _share(rows: list[Grade]) -> float | None:
    return round(sum(g.correct for g in rows) / len(rows), 3) if rows else None


def as_dicts(grades: list[Grade]) -> list[dict[str, Any]]:
    return [asdict(g) for g in grades]
