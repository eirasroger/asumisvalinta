"""Tests for the Posti Basic Address File parser, using three recorded records."""

import io
import zipfile
from pathlib import Path

import pytest

from asumisvalinta.ingestion import posti

SAMPLE = Path(__file__).parent / "data" / "baf_sample.dat"


@pytest.fixture
def records() -> list[dict]:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("BAF_20261003.dat", SAMPLE.read_bytes())
    return list(posti.parse_file(buffer.getvalue()))


def test_fields_are_read_at_their_positions(records):
    first = records[0]
    assert first["running_date"] == "20261003"
    assert first["postal_code"] == "00100"
    assert first["street_name_fi"] == "Mannerheimintie"
    assert first["street_name_sv"] == "Mannerheimvägen"
    assert first["building_data_type"] == "1"
    assert (first["lowest_number"], first["highest_number"]) == ("1", "13")
    assert first["municipality_code"] == "091"
    assert first["municipality_name_fi"] == "Helsinki"


def test_latin_1_letters_are_decoded(records):
    assert records[1]["street_name_fi"] == "Hämeentie"


def test_empty_fields_are_none(records):
    single = records[2]
    assert single["lowest_number"] == "1"
    assert single["highest_number"] is None


def test_latest_file_is_picked_from_the_download_page():
    page = (
        '<a href="BAF_20260926.zip">old</a><a href="BAF_20261003.zip">new</a>'
        '<a href="PCF_20261003.zip">postal codes</a><a href="arch/BAF_20251004.zip">archive</a>'
    )
    assert posti.latest_file_name(page) == "BAF_20261003.zip"


def test_a_page_without_the_file_fails():
    with pytest.raises(LookupError):
        posti.latest_file_name("<html></html>")
