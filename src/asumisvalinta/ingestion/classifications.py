"""dlt source for the Statistics Finland classification service.

Loads classification items (with the postal codes each price and rent area
includes) and municipality to region correspondences. Reloaded in full.
"""

from collections.abc import Iterator
from typing import Any
from urllib.parse import quote

import dlt
from dlt.sources.helpers import requests

BASE_URL = "https://data.stat.fi/api/classifications/v2"

CLASSIFICATIONS: tuple[str, ...] = (
    "kunta_1_20150101",
    "kunta_1_20260101",
    "maakunta_1_20150101",
    "maakunta_1_20260101",
    "alue_43_20260625",
    "alue_44_20260101",
)

CORRESPONDENCES: tuple[str, ...] = (
    "kunta_1_20150101#maakunta_1_20150101",
    "kunta_1_20260101#maakunta_1_20260101",
)


def _get(path: str, lang: str) -> list[dict[str, Any]]:
    response = requests.get(
        f"{BASE_URL}/{path}", params={"content": "data", "meta": "max", "lang": lang}, timeout=60
    )
    response.raise_for_status()
    return response.json()


def _name(item: dict[str, Any]) -> str | None:
    names = item.get("classificationItemNames") or []
    return names[0]["name"] if names else None


def _includes(item: dict[str, Any]) -> str | None:
    parts = [
        text
        for note in item.get("explanatoryNotes") or []
        for text in note.get("includes") or []
        if text
    ]
    return "; ".join(parts) or None


@dlt.resource(name="classification_items", write_disposition="replace")
def classification_items() -> Iterator[dict[str, Any]]:
    for classification in CLASSIFICATIONS:
        path = f"classifications/{classification}/classificationItems"
        english = {item["code"]: _name(item) for item in _get(path, "en")}
        for item in _get(path, "fi"):
            yield {
                "classification": classification,
                "code": item["code"],
                "level": item.get("level"),
                "parent_code": item.get("parentCode"),
                "sort_order": item.get("order"),
                "name_fi": _name(item),
                "name_en": english.get(item["code"]),
                "includes": _includes(item),
            }


@dlt.resource(name="correspondence_maps", write_disposition="replace")
def correspondence_maps() -> Iterator[dict[str, Any]]:
    for table in CORRESPONDENCES:
        for row in _get(f"correspondenceTables/{quote(table, safe='')}/maps", "fi"):
            yield {
                "correspondence_table": table,
                "source_code": row["sourceLocalId"].rsplit("/", 1)[1],
                "target_code": row["targetLocalId"].rsplit("/", 1)[1],
            }


@dlt.source(name="statfin_classifications")
def classifications_source() -> Any:
    return [classification_items, correspondence_maps]
