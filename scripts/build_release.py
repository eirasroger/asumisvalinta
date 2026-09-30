"""Build the release files from the warehouse.

- asumisvalinta-serving.duckdb: the marts and seeds only, read by the API. The file is
  created as asumisvalinta.duckdb so its catalog name matches the dbt manifest.
- raw-parquet.zip: every raw table as Parquet, enough to rebuild the history.

Usage: uv run python scripts/build_release.py [--source PATH] [--output DIR]
"""

import argparse
import shutil
import tempfile
import zipfile
from pathlib import Path

import duckdb

from asumisvalinta.config import REPO_ROOT, duckdb_path

SERVING_SCHEMAS = ("marts", "seeds")


def build_serving(source: Path, output: Path) -> Path:
    with tempfile.TemporaryDirectory() as workdir:
        target = Path(workdir) / "asumisvalinta.duckdb"
        connection = duckdb.connect(str(target))
        connection.execute(f"attach '{source.as_posix()}' as source (read_only)")
        for schema in SERVING_SCHEMAS:
            connection.execute(f"create schema {schema}")
            tables = connection.execute(
                "select table_name from information_schema.tables "
                "where table_catalog = 'source' and table_schema = ? and table_type = 'BASE TABLE'",
                [schema],
            ).fetchall()
            for (table,) in tables:
                connection.execute(
                    f"create table {schema}.{table} as select * from source.{schema}.{table}"
                )
        connection.execute("detach source")
        connection.execute("checkpoint")
        connection.close()
        destination = output / "asumisvalinta-serving.duckdb"
        shutil.copyfile(target, destination)
    return destination


def export_raw(source: Path, output: Path) -> Path:
    archive = output / "raw-parquet.zip"
    connection = duckdb.connect(str(source), read_only=True)
    tables = connection.execute(
        "select table_schema, table_name from information_schema.tables "
        "where table_schema like 'raw\\_%' escape '\\' and table_schema not like '%\\_staging' "
        "escape '\\' and table_name not like '\\_dlt%' escape '\\'"
    ).fetchall()
    with tempfile.TemporaryDirectory() as workdir, zipfile.ZipFile(archive, "w") as zipped:
        for schema, table in tables:
            path = Path(workdir) / f"{schema}.{table}.parquet"
            connection.execute(
                f"copy {schema}.{table} to '{path.as_posix()}' (format parquet, compression zstd)"
            )
            zipped.write(path, f"{schema}/{table}.parquet")
    connection.close()
    return archive


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=duckdb_path())
    parser.add_argument("--output", type=Path, default=REPO_ROOT / "dist")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for path in (build_serving(args.source, args.output), export_raw(args.source, args.output)):
        print(f"{path}: {path.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
