"""dlt source for ECB MIR interest rates on new housing loans in Finland.

Loads incrementally: each run requests only observations updated since the last run.
"""

import csv
import io
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import dlt
from dlt.sources.helpers import requests

DATA_URL = "https://data-api.ecb.europa.eu/service/data/MIR"

# Fixation periods: A all, F up to 1 year, I 1 to 5 years, O 5 to 10 years, P over 10 years.
SERIES_KEY = "M.FI.B.A2C.A+F+I+O+P.R.A.2250.EUR.N"

_client = requests.Client(raise_for_status=False)


@dlt.resource(
    name="mir_housing_loan_rates",
    write_disposition="merge",
    primary_key=["series_key", "time_period"],
)
def mir_housing_loan_rates() -> Iterator[dict[str, Any]]:
    state = dlt.current.resource_state()
    started = datetime.now(UTC).replace(microsecond=0).isoformat()
    params = {"format": "csvdata"}
    if state.get("updated_after"):
        params["updatedAfter"] = state["updated_after"]

    response = _client.get(f"{DATA_URL}/{SERIES_KEY}", params=params, timeout=120)
    if response.status_code == 404:  # no observations changed
        state["updated_after"] = started
        return
    response.raise_for_status()

    for record in csv.DictReader(io.StringIO(response.text)):
        yield {
            "series_key": record["KEY"],
            "time_period": record["TIME_PERIOD"],
            "fixation_period": record["MATURITY_NOT_IRATE"],
            "rate_pct": float(record["OBS_VALUE"]) if record["OBS_VALUE"] else None,
            "obs_status": record["OBS_STATUS"] or None,
            "obs_conf": record["OBS_CONF"] or None,
            "title": record["TITLE"],
        }
    state["updated_after"] = started


@dlt.source(name="ecb")
def ecb_source() -> Any:
    return mir_housing_loan_rates
