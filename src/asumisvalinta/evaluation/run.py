"""Run the golden set against the agents and write a report.

Usage:
  uv run asumisvalinta-eval --check                 compute every reference value, no model calls
  uv run asumisvalinta-eval [--agent semantic] [--agent baseline_sql] [--limit N] [--only ID ...]
"""

import argparse
import datetime as dt
import json
import logging
import sys
from pathlib import Path
from typing import Any

from asumisvalinta.agent import LLMSettings, OpenAIChatModel, baseline_agent, semantic_agent
from asumisvalinta.agent.tools import to_json
from asumisvalinta.config import REPO_ROOT, duckdb_path
from asumisvalinta.evaluation.golden import (
    GoldenQuestion,
    ReferenceError,
    expected_value,
    load_golden_set,
)
from asumisvalinta.evaluation.grading import Grade, as_dicts, grade, summarise
from asumisvalinta.semantic import SemanticLayer

RESULTS_DIR = REPO_ROOT / "evals" / "results"
AGENTS = {"semantic": semantic_agent, "baseline_sql": baseline_agent}


def check_references(questions: list[GoldenQuestion], warehouse: Path) -> int:
    semantic_layer = SemanticLayer(warehouse=warehouse)
    failures = 0
    for question in questions:
        try:
            value = expected_value(question, semantic_layer, warehouse)
            shown = "-" if value is None else f"{value:,.4f}"
            print(f"ok    {question.id:<45} {shown}")
        except (ReferenceError, LookupError, ValueError) as error:
            failures += 1
            print(f"FAIL  {question.id:<45} {error}")
    print(f"{len(questions) - failures} of {len(questions)} references computed")
    return failures


def evaluate(
    questions: list[GoldenQuestion], agent_names: list[str], warehouse: Path
) -> dict[str, Any]:
    golden = load_golden_set()
    semantic_layer = SemanticLayer(warehouse=warehouse)
    settings = LLMSettings.from_env()
    model = OpenAIChatModel(settings)
    expected = {q.id: expected_value(q, semantic_layer, warehouse) for q in questions}
    grades: list[Grade] = []
    transcripts: list[dict[str, Any]] = []
    for agent_name in agent_names:
        agent = AGENTS[agent_name](model, warehouse)
        for question in questions:
            run = agent.run(question.question)
            result = grade(question, run, expected[question.id], golden.tolerance_for(question))
            grades.append(result)
            transcripts.append(
                {
                    "agent": agent_name,
                    "question_id": question.id,
                    "status": run.status,
                    "answer": run.answer,
                    "value": run.value,
                    "unit": run.unit,
                    "sources": run.sources,
                    "error": run.error,
                    "tool_calls": [
                        {"tool": c.tool, "arguments": c.arguments, "ok": c.ok, "result": c.result}
                        for c in run.tool_calls
                    ],
                }
            )
            mark = "ok  " if result.correct else "MISS"
            print(f"{mark} {agent_name:<13} {question.id:<45} {result.reason}")
    return {
        "run_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "model": settings.model,
        "warehouse": str(warehouse),
        "summary": summarise(grades),
        "grades": as_dicts(grades),
        "transcripts": transcripts,
    }


def write_report(results: dict[str, Any], directory: Path = RESULTS_DIR) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = results["run_at"].replace(":", "").replace("-", "")[:15]
    (directory / f"{stamp}.json").write_text(to_json(results), encoding="utf-8")
    lines = [
        f"# Agent evaluation {results['run_at']}",
        "",
        f"Model: `{results['model']}`",
        "",
        "| Measure | " + " | ".join(results["summary"]) + " |",
        "|---|" + "---|" * len(results["summary"]),
    ]
    measures = next(iter(results["summary"].values())).keys()
    for measure in measures:
        values = [str(results["summary"][agent][measure]) for agent in results["summary"]]
        lines.append(f"| {measure} | " + " | ".join(values) + " |")
    lines += ["", "## Misses", ""]
    for g in results["grades"]:
        if not g["correct"]:
            lines.append(f"- `{g['agent']}` `{g['question_id']}`: {g['reason']}")
    report = directory / f"{stamp}.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--agent", action="append", choices=sorted(AGENTS))
    parser.add_argument("--only", action="append", help="question id to run")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--warehouse", type=Path, default=duckdb_path())
    parser.add_argument("--check", action="store_true", help="only compute reference values")
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING)

    questions = load_golden_set().questions
    if args.only:
        questions = [q for q in questions if q.id in set(args.only)]
    if args.limit:
        questions = questions[: args.limit]

    if args.check:
        sys.exit(1 if check_references(questions, args.warehouse) else 0)

    results = evaluate(questions, args.agent or sorted(AGENTS), args.warehouse)
    report = write_report(results)
    print(json.dumps(results["summary"], indent=2))
    print(f"Report: {report}")


if __name__ == "__main__":
    main()
