"""dlt source for Statistics Finland Paavo postal areas (attributes, no geometry)."""

from collections.abc import Iterator
from typing import Any

import dlt
from dlt.sources.helpers import requests

WFS_URL = "https://geo.stat.fi/geoserver/postialue/wfs"
PROPERTIES = "posti_alue,nimi,namn,kunta,vuosi,pinta_ala"
PAGE_SIZE = 5000


def _features(layer: str) -> Iterator[dict[str, Any]]:
    start = 0
    while True:
        response = requests.get(
            WFS_URL,
            params={
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "typeNames": layer,
                "outputFormat": "application/json",
                "propertyName": PROPERTIES,
                "count": PAGE_SIZE,
                "startIndex": start,
                "sortBy": "posti_alue",
            },
            timeout=120,
        )
        response.raise_for_status()
        features = response.json()["features"]
        yield from (f["properties"] for f in features)
        if len(features) < PAGE_SIZE:
            return
        start += PAGE_SIZE


@dlt.resource(
    name="postal_areas",
    write_disposition="merge",
    primary_key=["year", "postal_code"],
)
def postal_areas(years: tuple[int, ...]) -> Iterator[dict[str, Any]]:
    for year in years:
        for props in _features(f"postialue:pno_{year}"):
            yield {
                "year": props["vuosi"],
                "postal_code": props["posti_alue"],
                "name_fi": props["nimi"],
                "name_sv": props["namn"],
                "municipality_code": props["kunta"],
                "area_m2": props.get("pinta_ala"),
            }


@dlt.source(name="paavo")
def paavo_source(years: tuple[int, ...] = (2026,)) -> Any:
    return postal_areas(years)
