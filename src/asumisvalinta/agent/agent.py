"""Tool-calling agent loop with a log of every tool call."""

import contextlib
import json
import logging
import re
import time
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from asumisvalinta.agent import prompts
from asumisvalinta.agent.llm import ChatModel
from asumisvalinta.agent.tools import (
    ANSWER_TOOL,
    Tool,
    ToolError,
    answer_tool,
    scenario_tools,
    semantic_tools,
    sql_tools,
    to_json,
)
from asumisvalinta.config import duckdb_path
from asumisvalinta.semantic import SemanticLayer

log = logging.getLogger(__name__)

MAX_STEPS = 12
SUBMIT_REMINDER = "Call submit_answer now with your final answer."
ROUNDING_TOLERANCE = 0.005
UNGROUNDED_VALUE = (
    "The value {value} does not appear in any tool result. Report a number exactly as a tool "
    "returned it; to get a total, average or change, query the metric at the grain the "
    "question asks for."
)
MAX_CHART_SERIES = 3
MAX_CHART_CATEGORIES = 31
MAX_CHART_LABEL = 60
BAD_CHART = (
    "A chart needs kind bar or line, a short title, x_label and y_label, 1 to 31 categories "
    "(at least 2 for a line) and 1 to 3 series, each with a short name and one value (or null) "
    "per category, and at least 2 values in all. Fix it or set chart to null."
)
UNGROUNDED_TEXT = (
    "These numbers in the answer do not come from any tool result: {numbers}. Never calculate: "
    "for the rent or price of a flat of some size call flat_costs, otherwise report figures as "
    "a tool returned them or leave the numbers out."
)
SMALL_COUNT = 12
_NUMBER = re.compile(r"\d+(?:[ \u00a0\u202f,.]\d+)*")
UNGROUNDED_CHART = (
    "The chart value {value} does not appear in any tool result. Chart only numbers a tool "
    "returned, or set chart to null."
)
UNCHECKED_REFUSAL = (
    "Look the question up with the tools before refusing or asking for clarification; the data "
    "often covers it. Submit again if it still cannot be answered."
)


def numbers_in(result: str) -> list[float]:
    """Every number in a JSON tool result."""
    found: list[float] = []

    def walk(item: Any) -> None:
        if isinstance(item, bool):
            return
        if isinstance(item, int | float):
            found.append(float(item))
        elif isinstance(item, dict):
            for value in item.values():
                walk(value)
        elif isinstance(item, list):
            for value in item:
                walk(value)

    with contextlib.suppress(json.JSONDecodeError):
        walk(json.loads(result))
    return found


def is_grounded(value: float, results: list[str]) -> bool:
    """True when the value matches a number from a tool result, allowing for rounding."""
    for result in results:
        for number in numbers_in(result):
            if abs(value - number) <= max(abs(number) * ROUNDING_TOLERANCE, 0.01):
                return True
            if any(abs(value - round(number, digits)) < 1e-9 for digits in range(-2, 3)):
                return True
    return False


def _strings_in(result: str) -> list[str]:
    found: list[str] = []

    def walk(item: Any) -> None:
        if isinstance(item, str):
            found.append(item)
        elif isinstance(item, dict):
            for key, value in item.items():
                found.append(key)
                walk(value)
        elif isinstance(item, list):
            for value in item:
                walk(value)

    with contextlib.suppress(json.JSONDecodeError):
        walk(json.loads(result))
    return found


def _readings(token: str) -> list[float]:
    """The values a number written in English or Finnish style can have."""
    compact = re.sub(r"[ \u00a0\u202f]", "", token)
    readings = [compact.replace(",", ""), compact.replace(".", "").replace(",", ".")]
    values = []
    for reading in readings:
        with contextlib.suppress(ValueError):
            values.append(float(reading))
    return values


def ungrounded_numbers(text: str, results: list[str], given: str) -> list[str]:
    """Numbers in the text that no tool returned and the user did not write."""
    allowed_text = " ".join([given, *(s for result in results for s in _strings_in(result))])
    allowed = {value for token in _NUMBER.findall(allowed_text) for value in _readings(token)}

    def known(value: float) -> bool:
        if value <= SMALL_COUNT and value == int(value):
            return True
        if any(abs(value - other) < 1e-9 for other in allowed):
            return True
        return any(is_grounded(value * scale, results) for scale in (1, 100, 0.01))

    missing = []
    for token in _NUMBER.findall(text):
        if any(known(value) for value in _readings(token)):
            continue
        parts = re.split(r"[ \u00a0\u202f]+", token)
        if len(parts) > 1 and all(any(known(v) for v in _readings(part)) for part in parts):
            continue
        missing.append(token)
    return missing


def _label(text: Any) -> bool:
    return isinstance(text, str) and 0 < len(text) <= MAX_CHART_LABEL


def chart_error(chart: Any, results: list[str]) -> str | None:
    """Why a submitted chart is rejected, or None when it is absent or valid."""
    if chart is None:
        return None
    if not isinstance(chart, dict) or chart.get("kind") not in ("bar", "line"):
        return BAD_CHART
    categories, series = chart.get("categories"), chart.get("series")
    unit = chart.get("unit")
    if not _label(chart.get("title")) or not (unit is None or _label(unit)):
        return BAD_CHART
    if not _label(chart.get("x_label")) or not _label(chart.get("y_label")):
        return BAD_CHART
    if not isinstance(categories, list) or not 1 <= len(categories) <= MAX_CHART_CATEGORIES:
        return BAD_CHART
    if not isinstance(series, list) or not 1 <= len(series) <= MAX_CHART_SERIES:
        return BAD_CHART
    if not all(_label(category) for category in categories):
        return BAD_CHART
    if chart["kind"] == "line" and len(categories) < 2:
        return BAD_CHART
    for item in series:
        values = item.get("values") if isinstance(item, dict) else None
        if not _label(item.get("name") if isinstance(item, dict) else None):
            return BAD_CHART
        if not isinstance(values, list) or len(values) != len(categories):
            return BAD_CHART
        for value in values:
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, int | float):
                return BAD_CHART
            if not is_grounded(float(value), results):
                return UNGROUNDED_CHART.format(value=value)
    if sum(value is not None for item in series for value in item["values"]) < 2:
        return BAD_CHART
    return None


@dataclass(frozen=True)
class ToolCallRecord:
    step: int
    tool: str
    arguments: dict[str, Any]
    ok: bool
    result: str
    seconds: float


@dataclass
class AgentRun:
    agent: str
    model: str
    question: str
    status: str = "error"
    answer: str = ""
    value: float | None = None
    unit: str | None = None
    sources: str = ""
    chart: dict[str, Any] | None = None
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    error: str | None = None


@dataclass
class Agent:
    name: str
    system_prompt: str
    tools: list[Tool]
    model: ChatModel
    max_steps: int = MAX_STEPS

    def run(self, question: str, history: Sequence[tuple[str, str]] = ()) -> AgentRun:
        """`history` holds earlier (question, answer) pairs."""
        run = AgentRun(agent=self.name, model=self.model.name, question=question)
        tools = {tool.name: tool for tool in self.tools}
        schemas = [tool.schema for tool in self.tools]
        messages: list[dict[str, Any]] = [{"role": "system", "content": self.system_prompt}]
        for earlier_question, earlier_answer in history:
            messages.append({"role": "user", "content": earlier_question})
            messages.append({"role": "assistant", "content": earlier_answer})
        messages.append({"role": "user", "content": question})
        given = " ".join([question, *(text for pair in history for text in pair)])
        reminded = False
        for step in range(self.max_steps):
            response = self.model.complete(messages, schemas)
            run.prompt_tokens += response.prompt_tokens
            run.completion_tokens += response.completion_tokens
            messages.append(response.as_message())

            if not response.tool_calls:
                if reminded:
                    run.status, run.answer = "answered", response.content or ""
                    return run
                messages.append({"role": "user", "content": SUBMIT_REMINDER})
                reminded = True
                continue

            for call in response.tool_calls:
                record = self._execute(tools, call.name, call.arguments, step)
                if record.ok and call.name == ANSWER_TOOL:
                    record = self._check_grounding(record, run.tool_calls)
                if record.ok and call.name == ANSWER_TOOL:
                    record = self._check_chart(record, run.tool_calls)
                if record.ok and call.name == ANSWER_TOOL:
                    record = self._check_text(record, run.tool_calls, given)
                if record.ok and call.name == ANSWER_TOOL and not run.tool_calls:
                    record = self._check_unchecked_refusal(record)
                run.tool_calls.append(record)
                messages.append({"role": "tool", "tool_call_id": call.id, "content": record.result})
                if call.name == ANSWER_TOOL and record.ok:
                    answer = record.arguments
                    run.status = answer.get("status", "answered")
                    run.answer = answer.get("answer", "")
                    run.value = answer.get("value")
                    run.unit = answer.get("unit")
                    run.sources = answer.get("sources", "")
                    run.chart = answer.get("chart")
                    return run

        run.error = f"No answer after {self.max_steps} steps"
        return run

    @staticmethod
    def _check_unchecked_refusal(record: ToolCallRecord) -> ToolCallRecord:
        """Send back a refusal or clarification given before any tool was called."""
        if record.arguments.get("status") not in ("refused", "needs_clarification"):
            return record
        return ToolCallRecord(
            step=record.step,
            tool=record.tool,
            arguments=record.arguments,
            ok=False,
            result=to_json({"error": UNCHECKED_REFUSAL}),
            seconds=record.seconds,
        )

    @staticmethod
    def _check_text(
        record: ToolCallRecord, previous: list[ToolCallRecord], given: str
    ) -> ToolCallRecord:
        results = [call.result for call in previous if call.ok and call.tool != ANSWER_TOOL]
        results += [to_json(call.arguments) for call in previous if call.tool != ANSWER_TOOL]
        missing = ungrounded_numbers(str(record.arguments.get("answer", "")), results, given)
        if not missing:
            return record
        log.info("ungrounded_text %s", to_json({"numbers": missing}))
        return ToolCallRecord(
            step=record.step,
            tool=record.tool,
            arguments=record.arguments,
            ok=False,
            result=to_json({"error": UNGROUNDED_TEXT.format(numbers=", ".join(missing))}),
            seconds=record.seconds,
        )

    @staticmethod
    def _check_chart(record: ToolCallRecord, previous: list[ToolCallRecord]) -> ToolCallRecord:
        results = [call.result for call in previous if call.ok and call.tool != ANSWER_TOOL]
        error = chart_error(record.arguments.get("chart"), results)
        if error is None:
            return record
        return ToolCallRecord(
            step=record.step,
            tool=record.tool,
            arguments=record.arguments,
            ok=False,
            result=to_json({"error": error}),
            seconds=record.seconds,
        )

    @staticmethod
    def _check_grounding(record: ToolCallRecord, previous: list[ToolCallRecord]) -> ToolCallRecord:
        value = record.arguments.get("value")
        if not isinstance(value, int | float) or isinstance(value, bool):
            return record
        results = [call.result for call in previous if call.ok and call.tool != ANSWER_TOOL]
        if is_grounded(float(value), results):
            return record
        log.info("ungrounded_answer %s", to_json({"value": value}))
        return ToolCallRecord(
            step=record.step,
            tool=record.tool,
            arguments=record.arguments,
            ok=False,
            result=to_json({"error": UNGROUNDED_VALUE.format(value=value)}),
            seconds=record.seconds,
        )

    def _execute(
        self, tools: dict[str, Tool], name: str, raw_arguments: str, step: int
    ) -> ToolCallRecord:
        started = time.perf_counter()
        arguments: dict[str, Any] = {}
        try:
            arguments = json.loads(raw_arguments or "{}")
            if name not in tools:
                raise ToolError(f"Unknown tool {name}")
            result, ok = to_json(tools[name].handler(**arguments)), True
        except (ToolError, TypeError, ValueError) as error:
            result, ok = to_json({"error": str(error)}), False
        record = ToolCallRecord(
            step=step,
            tool=name,
            arguments=arguments,
            ok=ok,
            result=result,
            seconds=round(time.perf_counter() - started, 3),
        )
        log.info(
            "tool_call %s",
            to_json(
                {
                    "agent": self.name,
                    "step": step,
                    "tool": name,
                    "arguments": arguments,
                    "ok": ok,
                    "seconds": record.seconds,
                    "result_chars": len(result),
                }
            ),
        )
        return record


def metric_catalogue(semantic_layer: SemanticLayer) -> str:
    """One line per governed metric: its name, label and the first sentence of its definition."""
    lines = []
    for metric in semantic_layer.list_metrics():
        first_sentence = metric.description.strip().split(". ")[0].rstrip(".")
        lines.append(f"- {metric.name} ({metric.label}): {first_sentence}.")
    return "\n".join(lines)


def semantic_agent(model: ChatModel, warehouse: Path | None = None) -> Agent:
    warehouse = warehouse or duckdb_path()
    semantic_layer = SemanticLayer(warehouse=warehouse)
    tools = [
        *semantic_tools(semantic_layer, warehouse),
        *scenario_tools(warehouse),
        answer_tool(),
    ]
    prompt = prompts.semantic_agent_prompt(metric_catalogue(semantic_layer))
    return Agent("semantic", prompt, tools, model)


def baseline_agent(model: ChatModel, warehouse: Path | None = None) -> Agent:
    warehouse = warehouse or duckdb_path()
    tools = [*sql_tools(warehouse), *scenario_tools(warehouse), answer_tool()]
    return Agent("baseline_sql", prompts.BASELINE_AGENT, tools, model)
