"""dlt source for the Posti Basic Address File: streets and building number ranges by postal code.

The file is published weekly as a fixed-width ZIP; every run loads the latest file in full.
"""

import io
import re
import zipfile
from collections.abc import Iterator
from datetime import UTC, date, datetime
from typing import Any

import dlt
from dlt.sources.helpers import requests

INDEX_URL = "https://www.posti.fi/webpcode/"
FILE_PATTERN = re.compile(r"BAF_(\d{8})\.zip")
ENCODING = "latin-1"

# 1-based start position and length of each field, from Posti's record description.
FIELDS: dict[str, tuple[int, int]] = {
    "running_date": (6, 8),
    "postal_code": (14, 5),
    "postal_code_name_fi": (19, 30),
    "postal_code_name_sv": (49, 30),
    "street_name_fi": (103, 30),
    "street_name_sv": (133, 30),
    "building_data_type": (187, 1),
    "lowest_number": (188, 5),
    "lowest_letter": (193, 1),
    "lowest_number_2": (195, 5),
    "highest_number": (201, 5),
    "highest_letter": (206, 1),
    "highest_number_2": (208, 5),
    "municipality_code": (214, 3),
    "municipality_name_fi": (217, 20),
    "municipality_name_sv": (237, 20),
}


def latest_file_name(index_html: str) -> str:
    """Name of the newest Basic Address File listed on the download page."""
    names = sorted(set(FILE_PATTERN.findall(index_html)))
    if not names:
        raise LookupError(f"No Basic Address File listed at {INDEX_URL}")
    return f"BAF_{names[-1]}.zip"


def parse_record(line: str) -> dict[str, str | None]:
    return {
        name: line[start - 1 : start - 1 + length].strip() or None
        for name, (start, length) in FIELDS.items()
    }


def parse_file(content: bytes) -> Iterator[dict[str, str | None]]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        (name,) = archive.namelist()
        text = archive.read(name).decode(ENCODING)
    for line in text.splitlines():
        if line.strip():
            yield parse_record(line)


@dlt.resource(name="street_addresses", write_disposition="replace")
def street_addresses() -> Iterator[dict[str, Any]]:
    index = requests.get(INDEX_URL, timeout=60)
    index.raise_for_status()
    file_name = latest_file_name(index.text)
    response = requests.get(f"{INDEX_URL}{file_name}", timeout=300)
    response.raise_for_status()
    downloaded_at = datetime.now(UTC)
    for record in parse_file(response.content):
        running_date = record.pop("running_date")
        yield {
            **record,
            "extracted_on": date.fromisoformat(
                f"{running_date[:4]}-{running_date[4:6]}-{running_date[6:]}"
            )
            if running_date
            else None,
            "source_file": file_name,
            "downloaded_at": downloaded_at,
        }


@dlt.source(name="posti")
def posti_source() -> Any:
    return street_addresses()
