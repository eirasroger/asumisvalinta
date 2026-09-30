"""Tests for the PxWeb client and json-stat2 parser, using recorded responses for table 13mt."""

import json
import time
from pathlib import Path

import pytest

from asumisvalinta.ingestion import pxweb
from asumisvalinta.ingestion.statfin import TABLES

DATA = Path(__file__).parent / "data"
TABLE_13MT = next(t for t in TABLES if t.table_file == "13mt.px")


def _load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


@pytest.fixture
def rows() -> dict[tuple[str, str, str], dict]:
    parsed = pxweb.parse_jsonstat2(_load("13mt_sample.json"), TABLE_13MT)
    return {(r["period"], r["postal_code"], r["building_room_type"]): r for r in parsed}


def test_one_row_per_period_postal_code_and_type(rows):
    assert len(rows) == 2 * 4 * 4


def test_values_land_on_their_own_cell(rows):
    helsinki_one_room = rows[("2025Q4", "00100", "1")]
    assert helsinki_one_room["price_per_m2"] == 7561
    assert helsinki_one_room["transaction_count"] == 62
    assert rows[("2025Q4", "00100", "2")]["price_per_m2"] == 7257
    assert rows[("2026Q1", "00100", "1")]["price_per_m2"] == 7735
    assert rows[("2026Q1", "00100", "1")]["transaction_count"] == 21


def test_labels_follow_their_codes(rows):
    row = rows[("2025Q4", "00130", "3")]
    assert row["postal_code_label"].startswith("00130")
    assert row["building_room_type_label"] == "Blocks of flats, three-room flat+"


def test_confidential_and_empty_cells_keep_their_status(rows):
    confidential = rows[("2025Q4", "00130", "1")]
    assert confidential["price_per_m2"] is None
    assert confidential["price_per_m2_status"] == "..."
    assert confidential["transaction_count"] == 9

    empty = rows[("2025Q4", "00100", "5")]
    assert empty["price_per_m2"] is None
    assert empty["price_per_m2_status"] == "."


def test_preliminary_flag_comes_from_the_period_label(rows):
    assert rows[("2026Q1", "00100", "1")]["is_preliminary"] is True
    assert rows[("2025Q4", "00100", "1")]["is_preliminary"] is False


def test_queries_cover_all_periods_under_the_cell_limit():
    metadata = _load("13mt_metadata.json")
    queries = list(pxweb.build_queries(TABLE_13MT, metadata))
    periods = []
    for body in queries:
        selection = {q["code"]: q["selection"]["values"] for q in body["query"]}
        cells = 1
        for values in selection.values():
            cells *= len(values)
        assert cells <= pxweb.MAX_CELLS_PER_QUERY
        periods += selection["timeperiod_q"]
    all_periods = next(v["values"] for v in metadata["variables"] if v["code"] == "timeperiod_q")
    assert periods == all_periods


def test_changed_dimensions_raise():
    metadata = _load("13mt_metadata.json")
    metadata["variables"] = [v for v in metadata["variables"] if v["code"] != "contentscode"]
    with pytest.raises(ValueError, match="dimensions changed"):
        list(pxweb.build_queries(TABLE_13MT, metadata))


def test_rate_limiter_spaces_calls_beyond_the_limit():
    limiter = pxweb.RateLimiter(max_calls=2, window=0.3)
    start = time.monotonic()
    for _ in range(3):
        limiter.wait()
    assert time.monotonic() - start >= 0.3


@pytest.mark.live
@pytest.mark.parametrize("table", TABLES, ids=lambda t: t.name)
def test_table_still_exists_with_the_same_dimensions(table):
    assert pxweb.table_updated(table)
    next(pxweb.build_queries(table, pxweb.table_metadata(table)))
