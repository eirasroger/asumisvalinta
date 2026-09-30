"""Golden question set and the computation of expected answers."""

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from asumisvalinta.config import REPO_ROOT
from asumisvalinta.scenario import simulate
from asumisvalinta.scenario.defaults import load_defaults
from asumisvalinta.scenario.overrides import ScenarioOverrides, apply_overrides
from asumisvalinta.semantic import MetricQuery, SemanticLayer

GOLDEN_SET = REPO_ROOT / "evals" / "golden_set.yaml"

Kind = Literal["metric", "scenario", "refusal", "clarification"]
EXPECTED_STATUS: dict[Kind, str] = {
    "metric": "answered",
    "scenario": "answered",
    "refusal": "refused",
    "clarification": "needs_clarification",
}


class Tolerance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relative: float | None = Field(default=None, ge=0)
    absolute: float | None = Field(default=None, ge=0)

    def accepts(self, expected: float, actual: float) -> bool:
        difference = abs(actual - expected)
        if self.absolute is not None and difference <= self.absolute + 1e-9:
            return True
        return self.relative is not None and difference <= abs(expected) * self.relative + 1e-9


class ScenarioReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    postal_code: str
    room_type: str
    size_m2: float
    horizon_years: int
    overrides: ScenarioOverrides = Field(default_factory=ScenarioOverrides)


class Reference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metrics: list[str] = Field(default_factory=list)
    group_by: list[str] = Field(default_factory=list)
    where: list[str] = Field(default_factory=list)
    scenario: ScenarioReference | None = None
    output: str | None = None


class GoldenQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    question: str
    kind: Kind
    reference: Reference | None = None
    tolerance: Tolerance | None = None

    @model_validator(mode="after")
    def _reference_matches_kind(self) -> "GoldenQuestion":
        if self.kind == "metric" and not (self.reference and len(self.reference.metrics) == 1):
            raise ValueError(f"{self.id}: a metric question needs exactly one reference metric")
        if self.kind == "scenario" and not (
            self.reference and self.reference.scenario and self.reference.output
        ):
            raise ValueError(f"{self.id}: a scenario question needs a scenario and an output")
        return self

    @property
    def expected_status(self) -> str:
        return EXPECTED_STATUS[self.kind]


class GoldenSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defaults: dict[str, Any] = Field(default_factory=dict)
    questions: list[GoldenQuestion]

    def tolerance_for(self, question: GoldenQuestion) -> Tolerance:
        return question.tolerance or Tolerance(**self.defaults.get("tolerance", {}))


def load_golden_set(path: Path = GOLDEN_SET) -> GoldenSet:
    golden = GoldenSet.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
    ids = [question.id for question in golden.questions]
    duplicates = {question_id for question_id in ids if ids.count(question_id) > 1}
    if duplicates:
        raise ValueError(f"Duplicate question ids: {sorted(duplicates)}")
    return golden


class ReferenceError(ValueError):
    pass


def expected_value(
    question: GoldenQuestion, semantic_layer: SemanticLayer, warehouse: Path
) -> float | None:
    """The correct numeric answer, computed from the warehouse at evaluation time."""
    reference = question.reference
    if question.kind == "metric" and reference:
        result = semantic_layer.query(
            MetricQuery(
                metrics=tuple(reference.metrics),
                group_by=tuple(reference.group_by),
                where=tuple(reference.where),
            )
        )
        if len(result.rows) != 1 or result.rows[0][-1] is None:
            raise ReferenceError(f"{question.id}: expected one value, got {result.rows}")
        return float(result.rows[0][-1])
    if question.kind == "scenario" and reference and reference.scenario and reference.output:
        spec = reference.scenario
        defaults = load_defaults(
            spec.postal_code, spec.room_type, spec.size_m2, spec.horizon_years, warehouse=warehouse
        )
        outcome = simulate(apply_overrides(defaults.scenario, spec.overrides))
        field, _, option = reference.output.partition(".")
        value = getattr(outcome.option(option), field) if option else getattr(outcome, field)
        if value is None:
            raise ReferenceError(f"{question.id}: {reference.output} is empty")
        return float(value)
    return None
