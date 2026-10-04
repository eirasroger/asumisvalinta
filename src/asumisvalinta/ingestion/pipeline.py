"""Run the ingestion pipelines into the DuckDB warehouse, one raw schema per source."""

import argparse
import logging
from collections.abc import Callable
from typing import Any

import dlt

from asumisvalinta.config import duckdb_path
from asumisvalinta.ingestion.classifications import classifications_source
from asumisvalinta.ingestion.ecb import ecb_source
from asumisvalinta.ingestion.paavo import paavo_source
from asumisvalinta.ingestion.posti import posti_source
from asumisvalinta.ingestion.statfin import TABLES, statfin_source

log = logging.getLogger(__name__)

SOURCES: dict[str, tuple[str, Callable[[bool], Any]]] = {
    "statfin": ("raw_statfin", lambda force: statfin_source(force=force)),
    "classifications": ("raw_statfin_classifications", lambda force: classifications_source()),
    "paavo": ("raw_paavo", lambda force: paavo_source()),
    "ecb": ("raw_ecb", lambda force: ecb_source()),
    "posti": ("raw_posti", lambda force: posti_source()),
}


def run(sources: list[str], tables: list[str] | None = None, force: bool = False) -> None:
    path = duckdb_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    for name in sources:
        dataset, factory = SOURCES[name]
        source = factory(force)
        if name == "statfin" and tables:
            source = source.with_resources(*tables)
        pipeline = dlt.pipeline(
            pipeline_name=f"asumisvalinta_{name}",
            destination=dlt.destinations.duckdb(str(path)),
            dataset_name=dataset,
        )
        info = pipeline.run(source)
        log.info("%s", info)
        print(info)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--source", action="append", choices=sorted(SOURCES), help="default: all sources"
    )
    parser.add_argument(
        "--table",
        action="append",
        choices=[t.name for t in TABLES],
        help="limit the statfin source to these tables",
    )
    parser.add_argument(
        "--force", action="store_true", help="reload StatFin tables even if unchanged"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    run(args.source or list(SOURCES), args.table, args.force)


if __name__ == "__main__":
    main()
