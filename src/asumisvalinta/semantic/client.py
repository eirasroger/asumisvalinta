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


@dataclass(frozen=True)
class MetricQuery:
    metrics: tuple[str, ...]
    group_by: tuple[str, ...] = ()
    where: tuple[str, ...] = ()
    order_by: tuple[str, ...] = ()
    limit: int | None = None


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

    def query(self, query: MetricQuery) -> MetricResult:
        self._check_metrics(query.metrics)
        request = MetricFlowQueryRequest.create(
            metric_names=list(query.metrics),
            group_by_names=list(query.group_by) or None,
            where_constraints=list(query.where) or None,
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
