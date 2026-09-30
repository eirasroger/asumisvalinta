"""Tool-calling agent loop with a log of every tool call."""

import json
import logging
import time
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

    def run(self, question: str) -> AgentRun:
        run = AgentRun(agent=self.name, model=self.model.name, question=question)
        tools = {tool.name: tool for tool in self.tools}
        schemas = [tool.schema for tool in self.tools]
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": question},
        ]
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
                run.tool_calls.append(record)
                messages.append({"role": "tool", "tool_call_id": call.id, "content": record.result})
                if call.name == ANSWER_TOOL and record.ok:
                    answer = record.arguments
                    run.status = answer.get("status", "answered")
                    run.answer = answer.get("answer", "")
                    run.value = answer.get("value")
                    run.unit = answer.get("unit")
                    run.sources = answer.get("sources", "")
                    return run

        run.error = f"No answer after {self.max_steps} steps"
        return run

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


def semantic_agent(model: ChatModel, warehouse: Path | None = None) -> Agent:
    warehouse = warehouse or duckdb_path()
    tools = [
        *semantic_tools(SemanticLayer(warehouse=warehouse), warehouse),
        *scenario_tools(warehouse),
        answer_tool(),
    ]
    return Agent("semantic", prompts.SEMANTIC_AGENT, tools, model)


def baseline_agent(model: ChatModel, warehouse: Path | None = None) -> Agent:
    warehouse = warehouse or duckdb_path()
    tools = [*sql_tools(warehouse), *scenario_tools(warehouse), answer_tool()]
    return Agent("baseline_sql", prompts.BASELINE_AGENT, tools, model)
