"""Client and parser for the Statistics Finland PxWeb API v1."""

import math
import threading
import time
from collections import deque
from collections.abc import Iterator
from dataclasses import dataclass, field
from itertools import product
from typing import Any

from dlt.sources.helpers import requests

BASE_URL = "https://pxdata.stat.fi/PXWeb/api/v1/en"
MAX_CELLS_PER_QUERY = 100_000
MAX_CALLS = 40
WINDOW_SECONDS = 60.0
PRELIMINARY_MARK = "*"


@dataclass(frozen=True)
class PxTable:
    """One PxWeb table and how its dimensions map to raw column names.

    `dimensions` maps every non-content dimension code to a column name; each
    dimension yields `<column>` (code) and `<column>_label`. `contents` maps the
    content codes to load to column names; each yields `<column>` (value) and
    `<column>_status` (PxWeb status marker such as "..." for confidential).
    """

    name: str
    database: str
    subject: str
    table_file: str
    time_dimension: str
    content_dimension: str
    dimensions: dict[str, str]
    contents: dict[str, str]
    selection: dict[str, list[str]] = field(default_factory=dict)

    @property
    def url(self) -> str:
        return f"{BASE_URL}/{self.database}/{self.subject}/{self.table_file}"

    @property
    def listing_url(self) -> str:
        return f"{BASE_URL}/{self.database}/{self.subject}"


class RateLimiter:
    """Blocks so that at most `max_calls` calls start within any `window` seconds."""

    def __init__(self, max_calls: int = MAX_CALLS, window: float = WINDOW_SECONDS) -> None:
        self.max_calls = max_calls
        self.window = window
        self._calls: deque[float] = deque()
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            while self._calls and now - self._calls[0] >= self.window:
                self._calls.popleft()
            if len(self._calls) >= self.max_calls:
                time.sleep(self.window - (now - self._calls[0]) + 0.1)
                self._calls.popleft()
            self._calls.append(time.monotonic())


_limiter = RateLimiter()


def _get(url: str) -> Any:
    _limiter.wait()
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def _post(url: str, body: dict[str, Any]) -> Any:
    _limiter.wait()
    response = requests.post(url, json=body, timeout=120)
    response.raise_for_status()
    return response.json()


def table_updated(table: PxTable) -> str:
    """The table's last-updated timestamp from its folder listing."""
    for item in _get(table.listing_url):
        if item.get("id") == table.table_file:
            return item["updated"]
    raise LookupError(f"{table.table_file} not found in {table.listing_url}")


def table_metadata(table: PxTable) -> dict[str, Any]:
    return _get(table.url)


def build_queries(table: PxTable, metadata: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield query bodies that cover the whole table, split along the time dimension."""
    variables = {v["code"]: v["values"] for v in metadata["variables"]}
    expected = {*table.dimensions, table.content_dimension}
    missing = expected - variables.keys()
    extra = variables.keys() - expected
    if missing or extra:
        raise ValueError(
            f"{table.name}: dimensions changed at source. Missing {sorted(missing)}, "
            f"unexpected {sorted(extra)}."
        )

    selected = {code: list(values) for code, values in variables.items()}
    selected[table.content_dimension] = list(table.contents)
    for code, values in table.selection.items():
        selected[code] = values

    periods = selected[table.time_dimension]
    cells_per_period = math.prod(
        len(v) for code, v in selected.items() if code != table.time_dimension
    )
    batch = max(1, MAX_CELLS_PER_QUERY // cells_per_period)
    for start in range(0, len(periods), batch):
        chunk = dict(selected)
        chunk[table.time_dimension] = periods[start : start + batch]
        yield {
            "query": [
                {"code": code, "selection": {"filter": "item", "values": values}}
                for code, values in chunk.items()
            ],
            "response": {"format": "json-stat2"},
        }


def _at(container: Any, position: int) -> Any:
    """Read a json-stat2 value or status entry stored as list, dict or scalar."""
    if container is None:
        return None
    if isinstance(container, list):
        return container[position]
    if isinstance(container, dict):
        return container.get(str(position))
    return container


def parse_jsonstat2(doc: dict[str, Any], table: PxTable) -> Iterator[dict[str, Any]]:
    """Turn a json-stat2 dataset into one row per non-content cell combination."""
    dims: list[str] = doc["id"]
    sizes: list[int] = doc["size"]
    categories: list[list[tuple[str, str]]] = []
    for dim in dims:
        category = doc["dimension"][dim]["category"]
        index = category["index"]
        codes = index if isinstance(index, list) else sorted(index, key=index.get)
        labels = category.get("label", {})
        categories.append([(code, labels.get(code, code)) for code in codes])

    strides = [math.prod(sizes[i + 1 :]) for i in range(len(sizes))]
    content_axis = dims.index(table.content_dimension)
    other_axes = [i for i in range(len(dims)) if i != content_axis]
    values = doc["value"]
    status = doc.get("status")

    for combo in product(*(range(sizes[i]) for i in other_axes)):
        offset = sum(strides[axis] * k for axis, k in zip(other_axes, combo, strict=True))
        row: dict[str, Any] = {}
        for axis, k in zip(other_axes, combo, strict=True):
            code, label = categories[axis][k]
            column = table.dimensions[dims[axis]]
            row[column] = code
            row[f"{column}_label"] = label
            if dims[axis] == table.time_dimension:
                row["is_preliminary"] = label.endswith(PRELIMINARY_MARK)
        for k, (code, _) in enumerate(categories[content_axis]):
            position = offset + strides[content_axis] * k
            column = table.contents[code]
            row[column] = _at(values, position)
            row[f"{column}_status"] = _at(status, position)
        yield row


def fetch_rows(table: PxTable) -> Iterator[dict[str, Any]]:
    """Download the whole table in chunks and yield parsed rows."""
    metadata = table_metadata(table)
    for body in build_queries(table, metadata):
        yield from parse_jsonstat2(_post(table.url, body), table)
