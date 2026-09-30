"""MetricFlow SQL client on a read-only DuckDB connection, without a dbt adapter.

The dbt adapter used by the MetricFlow CLI needs multiprocessing locks, which serverless
runtimes do not provide, and it loads the whole dbt project on start.
"""

from pathlib import Path

from metricflow.data_table.mf_table import MetricFlowDataTable
from metricflow.protocols.sql_client import SqlEngine
from metricflow.sql.render.duckdb_renderer import DuckDbSqlPlanRenderer
from metricflow.sql.render.sql_plan_renderer import SqlPlanRenderer
from metricflow_semantics.errors.error_classes import SqlBindParametersNotSupportedError
from metricflow_semantics.sql.sql_bind_parameters import SqlBindParameterSet

from asumisvalinta.config import connect_read_only

NO_PARAMETERS = SqlBindParameterSet()
NO_PARAMETERS_MESSAGE = "Bind parameters are not used with DuckDB here."


class DuckDbSqlClient:
    def __init__(self, warehouse: Path) -> None:
        self._connection = connect_read_only(warehouse)
        self._renderer = DuckDbSqlPlanRenderer()

    @property
    def sql_engine_type(self) -> SqlEngine:
        return SqlEngine.DUCKDB

    @property
    def sql_plan_renderer(self) -> SqlPlanRenderer:
        return self._renderer

    def query(
        self, stmt: str, sql_bind_parameter_set: SqlBindParameterSet = NO_PARAMETERS
    ) -> MetricFlowDataTable:
        self._reject_parameters(sql_bind_parameter_set)
        cursor = self._connection.cursor()
        try:
            cursor.execute(stmt)
            columns = [column[0] for column in cursor.description]
            rows = cursor.fetchall()
            return MetricFlowDataTable.create_from_rows(column_names=columns, rows=rows)
        finally:
            cursor.close()

    def execute(
        self, stmt: str, sql_bind_parameter_set: SqlBindParameterSet = NO_PARAMETERS
    ) -> None:
        self._reject_parameters(sql_bind_parameter_set)
        cursor = self._connection.cursor()
        try:
            cursor.execute(stmt)
        finally:
            cursor.close()

    def dry_run(
        self, stmt: str, sql_bind_parameter_set: SqlBindParameterSet = NO_PARAMETERS
    ) -> None:
        self.execute(f"explain {stmt}", sql_bind_parameter_set)

    def close(self) -> None:
        self._connection.close()

    def render_bind_parameter_key(self, bind_parameter_key: str) -> str:
        raise SqlBindParametersNotSupportedError(NO_PARAMETERS_MESSAGE)

    @staticmethod
    def _reject_parameters(parameters: SqlBindParameterSet) -> None:
        if parameters.param_dict:
            raise SqlBindParametersNotSupportedError(NO_PARAMETERS_MESSAGE)
