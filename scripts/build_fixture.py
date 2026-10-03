"""Build the CI fixture: a small slice of the raw warehouse tables written as Parquet.

The postal codes cover every fallback level of the market level mart: postal
codes with their own prices, cities with price and rent sub-areas, a city
without sub-areas and sparsely populated areas that fall back to region level.

Usage: uv run python scripts/build_fixture.py [--source PATH] [--table SCHEMA.TABLE ...]
"""

import argparse
from pathlib import Path

import duckdb

from asumisvalinta.config import REPO_ROOT, duckdb_path

FIXTURE_DIR = REPO_ROOT / "fixtures" / "raw"

POSTAL_CODES = ("00100", "00130", "00530", "02230", "33100", "33720", "96100", "99990", "42720")
MUNICIPALITIES = ("091", "049", "837", "698", "890")
REGIONS = ("MK01", "MK06", "MK19")
AREAS = ("SSS", "ksu", "pks", "msu", *MUNICIPALITIES, *REGIONS, "A01", "A06", "A19")
SUB_AREA_PREFIXES = ("091-", "091_", "049-", "049_", "837-", "837_")


def _in(values: tuple[str, ...]) -> str:
    return "(" + ", ".join(f"'{v}'" for v in values) + ")"


def _area_filter(column: str) -> str:
    prefixes = " or ".join(f"{column} like '{p}%'" for p in SUB_AREA_PREFIXES)
    return f"({column} in {_in(AREAS)} or {prefixes})"


TABLES: dict[str, str] = {
    "raw_statfin.prices_postal_quarterly": (
        f"postal_code in {_in(POSTAL_CODES)} and period >= '2023Q1'"
    ),
    "raw_statfin.prices_postal_yearly": f"postal_code in {_in(POSTAL_CODES)} and period >= '2022'",
    "raw_statfin.prices_municipality_yearly": (
        f"municipality_code in {_in(MUNICIPALITIES)} and period >= '2022'"
    ),
    "raw_statfin.prices_postal_by_construction_yearly_2010": (
        "period >= '2017' and price_per_m2 is not null"
    ),
    "raw_statfin.price_index_area_quarterly": _area_filter("price_area"),
    "raw_statfin.price_index_area_chained": (
        f"{_area_filter('price_area')} and period >= '2014Q1'"
    ),
    "raw_statfin.rents_postal_quarterly_2015": (
        f"postal_code in {_in(POSTAL_CODES)} and period >= '2024Q1'"
    ),
    "raw_statfin.rents_area_quarterly_2015": f"{_area_filter('rent_area')} and period >= '2014Q1'",
    "raw_statfin.rents_area_quarterly": _area_filter("rent_area"),
    "raw_statfin.price_distribution_area_quarterly": _area_filter("price_area"),
    "raw_statfin.rent_distribution_area_quarterly": _area_filter("rent_area"),
    "raw_statfin.building_cost_index_monthly": "period >= '2015M01'",
    "raw_statfin.housing_company_finances_yearly": "account_item = 'k3001'",
    "raw_statfin.housing_company_finances_yearly_2009": (
        "account_item = 'k3001' and period >= '2014'"
    ),
    "raw_statfin.housing_company_finances_by_age_yearly": (
        "account_item in ('k3001', 'k3283') and company_type = '2'"
    ),
    "raw_statfin.owner_renovation_costs_yearly": "true",
    "raw_statfin.consumer_price_index_yearly": "true",
    "raw_statfin_classifications.classification_items": "true",
    "raw_statfin_classifications.correspondence_maps": "true",
    "raw_statfin_classifications.area_postal_codes": "true",
    "raw_paavo.postal_areas": "true",
    "raw_ecb.mir_interest_rates": "time_period >= '2020-01'",
}


def build(source: Path, tables: list[str] | None = None) -> None:
    connection = duckdb.connect(str(source), read_only=True)
    for table, condition in TABLES.items():
        if tables and table not in tables:
            continue
        schema, name = table.split(".")
        target = FIXTURE_DIR / schema / f"{name}.parquet"
        target.parent.mkdir(parents=True, exist_ok=True)
        columns = [
            row[0]
            for row in connection.execute(
                "select column_name from information_schema.columns "
                "where table_schema = ? and table_name = ? and column_name not like '\\_dlt%' "
                "escape '\\' order by ordinal_position",
                [schema, name],
            ).fetchall()
        ]
        query = f"select {', '.join(columns)} from {table} where {condition}"
        connection.execute(
            f"copy ({query}) to '{target.as_posix()}' (format parquet, compression zstd)"
        )
        rows = connection.execute(f"select count(*) from ({query})").fetchone()[0]
        print(f"{table}: {rows} rows")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=duckdb_path())
    parser.add_argument("--table", action="append", choices=sorted(TABLES), help="default: all")
    args = parser.parse_args()
    build(args.source, args.table)


if __name__ == "__main__":
    main()
