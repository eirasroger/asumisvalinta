"""Create a DuckDB warehouse from the Parquet fixture, one raw schema per source.

Usage: uv run python scripts/load_fixture.py [--target PATH]
"""

import argparse
from pathlib import Path

import duckdb

from asumisvalinta.config import REPO_ROOT, duckdb_path

FIXTURE_DIR = REPO_ROOT / "fixtures" / "raw"


def load(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(target))
    for parquet in sorted(FIXTURE_DIR.glob("*/*.parquet")):
        schema, table = parquet.parent.name, parquet.stem
        connection.execute(f"create schema if not exists {schema}")
        connection.execute(
            f"create or replace table {schema}.{table} as "
            f"select * from read_parquet('{parquet.as_posix()}')"
        )
    connection.close()
    print(f"Loaded fixture into {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--target", type=Path, default=duckdb_path())
    load(parser.parse_args().target)


if __name__ == "__main__":
    main()
