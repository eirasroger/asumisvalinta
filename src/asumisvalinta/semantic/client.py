"""Thin client over the MetricFlow engine for the dbt project in this repository.

Metrics whose label ends with "(component)" exist only to build ratio and derived
metrics; they are hidden from `list_metrics` and cannot be queried directly.
"""

import os
import re
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path
from typing import Any

from dbt_metricflow.cli.cli_configuration import CLIConfiguration
from metricflow.engine.metricflow_engine import MetricFlowEngine, MetricFlowQueryRequest

from asumisvalinta.config import REPO_ROOT, duckdb_path

DBT_PROJECT_DIR = REPO_ROOT / "dbt"
COMPONENT_LABEL_SUFFIX = "(component)"
READ_ONLY_TARGET = "duckdb_readonly"


@dataclass(frozen=True)
class MetricInfo:
    name: str
    label: str
    description: str


OPERATORS = ("=", "!=", ">", ">=", "<", "<=", "in")
TIME_PREFIX = "metric_time__"
GEOGRAPHY = "area or postal_area"

# Area-level rows hold published totals next to their details (for example "all rooms"
# next to each room type). A query on them must fix these dimensions to one value or group
# by them, so totals and details are never added together. Postal code rows hold details
# only, so a query fixed to a postal code needs only the geography.
REQUIRED_GRAIN: dict[str, tuple[str, ...]] = {
    "dwelling_prices": ("room_type", "dwelling_price__building_type", GEOGRAPHY),
    "price_index": ("room_type", "price_index_observation__building_type", GEOGRAPHY),
    "rents": ("room_type", GEOGRAPHY),
    "housing_company_charges": ("housing_company_charge__building_type", GEOGRAPHY),
    "market_levels": ("room_type",),
}

_QUARTER = re.compile(r"^(\d{4})\s*-?\s*Q([1-4])$", re.IGNORECASE)
_YEAR = re.compile(r"^\d{4}$")
_MONTH = re.compile(r"^\d{4}-\d{2}$")


def normalise_time(value: str) -> str:
    """First day of a period written as 2024, 2025Q4, 2023-07 or a date."""
    text = str(value).strip()
    if _YEAR.match(text):
        return f"{text}-01-01"
    if match := _QUARTER.match(text):
        month = (int(match.group(2)) - 1) * 3 + 1
        return f"{match.group(1)}-{month:02d}-01"
    if _MONTH.match(text):
        return f"{text}-01"
    return text[:10]


@dataclass(frozen=True)
class Filter:
    """A condition on an entity (postal_area), a dimension (entity__name) or a time grain
    (metric_time__quarter), rendered into MetricFlow's filter syntax."""

    field: str
    operator: str
    value: str | float | list[str]

    def to_where(self) -> str:
        if self.operator not in OPERATORS:
            raise ValueError(f"Unknown operator {self.operator}; use one of {', '.join(OPERATORS)}")
        value = self.value
        if self.field.startswith(TIME_PREFIX):
            grain = self.field.removeprefix(TIME_PREFIX)
            target = f"{{{{ TimeDimension('metric_time', '{grain}') }}}}"
            value = (
                [normalise_time(v) for v in value]
                if isinstance(value, list)
                else normalise_time(str(value))
            )
        elif "__" in self.field:
            target = f"{{{{ Dimension('{self.field}') }}}}"
        else:
            target = f"{{{{ Entity('{self.field}') }}}}"
        if self.operator == "in":
            values = value if isinstance(value, list) else [value]
            return f"{target} in ({', '.join(_literal(v) for v in values)})"
        if isinstance(value, list):
            raise ValueError(f"Operator {self.operator} takes a single value")
        return f"{target} {self.operator} {_literal(value)}"


def _literal(value: str | float) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | float):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


@dataclass(frozen=True)
class MetricQuery:
    metrics: tuple[str, ...]
    group_by: tuple[str, ...] = ()
    where: tuple[str, ...] = ()
    order_by: tuple[str, ...] = ()
    limit: int | None = None
    filters: tuple[Filter, ...] = ()

    @property
    def where_constraints(self) -> list[str]:
        return [*self.where, *(condition.to_where() for condition in self.filters)]


@dataclass(frozen=True)
class MetricResult:
    columns: tuple[str, ...]
    rows: tuple[tuple[Any, ...], ...]
    sql: str = field(repr=False)

    def records(self) -> list[dict[str, Any]]:
        return [dict(zip(self.columns, row, strict=True)) for row in self.rows]


class UnknownMetricError(ValueError):
    pass


class SemanticLayer:
    def __init__(self, project_dir: Path = DBT_PROJECT_DIR, warehouse: Path | None = None) -> None:
        self._project_dir = project_dir
        self._warehouse = warehouse or duckdb_path()

    @cached_property
    def _engine(self) -> MetricFlowEngine:
        os.environ["ASUMISVALINTA_DUCKDB_PATH"] = str(Path(self._warehouse).resolve())
        os.environ["DBT_TARGET"] = READ_ONLY_TARGET
        configuration = CLIConfiguration()
        configuration.setup(
            dbt_profiles_path=self._project_dir,
            dbt_project_path=self._project_dir,
            configure_file_logging=False,
        )
        return configuration.mf

    @cached_property
    def _metrics(self) -> dict[str, MetricInfo]:
        metrics = {}
        for metric in self._engine.list_metrics():
            label = getattr(metric, "label", None) or metric.name
            if label.endswith(COMPONENT_LABEL_SUFFIX):
                continue
            metrics[metric.name] = MetricInfo(metric.name, label, metric.description or "")
        return metrics

    def list_metrics(self) -> list[MetricInfo]:
        return sorted(self._metrics.values(), key=lambda metric: metric.name)

    def list_dimensions(self, metric_names: list[str]) -> list[str]:
        """Dimensions and entities the metrics can be grouped by and filtered on."""
        self._check_metrics(metric_names)
        names = {
            getattr(item, "dunder_name", None) or item.name
            for item in self._engine.list_group_bys(list(metric_names))
        }
        return sorted(names)

    def dimension_values(self, metric_names: list[str], dimension: str) -> list[str]:
        """Distinct values of a dimension or time grain for the given metrics.

        Derived metrics with a time offset cannot be queried for values directly, so
        their input metrics are used instead.
        """
        self._check_metrics(metric_names)
        names = [base for name in metric_names for base in self._base_metrics(name)]
        return self._engine.get_dimension_values(
            metric_names=list(dict.fromkeys(names)), get_group_by_values=dimension
        )

    def missing_grain(self, query: "MetricQuery") -> list[str]:
        """Dimensions that must be fixed to one value or grouped by, and are not."""
        self._check_metrics(query.metrics)
        pinned = set(query.group_by)
        pinned |= {condition.field for condition in query.filters if condition.operator == "="}
        by_postal_code = any(name.startswith("postal_area") for name in pinned)
        by_area = any(name == "area" or name.startswith("area__") for name in pinned)
        missing: list[str] = []
        for model in self._semantic_models(query.metrics):
            for requirement in REQUIRED_GRAIN.get(model, ()):
                if requirement == GEOGRAPHY:
                    satisfied = by_postal_code or by_area
                else:
                    satisfied = requirement in pinned or (by_postal_code and not by_area)
                if not satisfied and requirement not in missing:
                    missing.append(requirement)
        return missing

    def _semantic_models(self, metric_names: tuple[str, ...] | list[str]) -> set[str]:
        definitions = self._definitions
        return {
            getattr(model, "semantic_model_name", str(model))
            for name in metric_names
            for model in (definitions[name].semantic_models or ())
        }

    def _base_metrics(self, name: str) -> list[str]:
        definition = self._definitions[name]
        inputs = getattr(definition.type_params, "metrics", None) or []
        has_offset = any(item.offset_window or item.offset_to_grain for item in inputs)
        return [item.name for item in inputs] if has_offset else [name]

    @cached_property
    def _definitions(self) -> dict[str, Any]:
        return {metric.name: metric for metric in self._engine.list_metrics()}

    def query(self, query: MetricQuery) -> MetricResult:
        self._check_metrics(query.metrics)
        request = MetricFlowQueryRequest.create(
            metric_names=list(query.metrics),
            group_by_names=list(query.group_by) or None,
            where_constraints=query.where_constraints or None,
            order_by_names=list(query.order_by) or None,
            limit=query.limit,
        )
        result = self._engine.query(request)
        table = result.result_df
        return MetricResult(
            columns=tuple(table.column_names),
            rows=tuple(tuple(row) for row in table.rows),
            sql=result.sql or "",
        )

    def _check_metrics(self, metric_names: tuple[str, ...] | list[str]) -> None:
        unknown = [name for name in metric_names if name not in self._metrics]
        if unknown:
            raise UnknownMetricError(f"Unknown metrics: {', '.join(unknown)}")
