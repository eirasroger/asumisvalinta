"""Thin client over the MetricFlow engine for the dbt project in this repository.

Metrics whose label ends with "(component)" exist only to build ratio and derived
metrics; they are hidden from `list_metrics` and cannot be queried directly.
"""

import os
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
        if self.field.startswith(TIME_PREFIX):
            grain = self.field.removeprefix(TIME_PREFIX)
            target = f"{{{{ TimeDimension('metric_time', '{grain}') }}}}"
        elif "__" in self.field:
            target = f"{{{{ Dimension('{self.field}') }}}}"
        else:
            target = f"{{{{ Entity('{self.field}') }}}}"
        if self.operator == "in":
            values = self.value if isinstance(self.value, list) else [self.value]
            return f"{target} in ({', '.join(_literal(v) for v in values)})"
        if isinstance(self.value, list):
            raise ValueError(f"Operator {self.operator} takes a single value")
        return f"{target} {self.operator} {_literal(self.value)}"


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
        """Distinct values of a dimension or time grain for the given metrics."""
        self._check_metrics(metric_names)
        return self._engine.get_dimension_values(
            metric_names=list(metric_names), get_group_by_values=dimension
        )

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
