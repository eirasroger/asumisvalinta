"""Location and availability of the fixture warehouse built by dbt."""

import os
from pathlib import Path

import duckdb
import pytest

from asumisvalinta.config import REPO_ROOT

WAREHOUSE = Path(
    os.environ.get("ASUMISVALINTA_TEST_WAREHOUSE", REPO_ROOT / "data" / "fixture.duckdb")
)


def _built(path: Path) -> bool:
    if not path.exists():
        return False
    with duckdb.connect(str(path), read_only=True) as connection:
        return bool(
            connection.execute(
                "select count(*) from information_schema.tables "
                "where table_schema = 'marts' and table_name = 'mart_market_levels'"
            ).fetchone()[0]
        )


requires_warehouse = [
    pytest.mark.warehouse,
    pytest.mark.skipif(not _built(WAREHOUSE), reason="fixture warehouse is not built"),
]
