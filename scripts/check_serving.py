"""Call the API routes the website uses against a serving warehouse.

Run after `scripts/vercel_build.py`, which downloads the warehouse of the latest release
and parses the dbt project, so the check sees what a deployment would see.
"""

import os
import sys
from pathlib import Path

from asumisvalinta.config import REPO_ROOT

DEFAULT_WAREHOUSE = REPO_ROOT / "serving" / "asumisvalinta.duckdb"
FLAT = {"postal_code": "00100", "room_type": "two_room", "size_m2": 55, "building_year": 1980}


def main() -> None:
    warehouse = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WAREHOUSE
    os.environ["ASUMISVALINTA_DUCKDB_PATH"] = str(warehouse)
    os.environ["ASUMISVALINTA_LLM_API_KEY"] = ""
    os.environ["OPENAI_API_KEY"] = ""

    from fastapi.testclient import TestClient

    from asumisvalinta.api.app import app

    client = TestClient(app, raise_server_exceptions=False)
    failures = []

    def check(method: str, path: str, **kwargs):
        response = client.request(method, path, **kwargs)
        print(f"{response.status_code} {method} {path}")
        if response.status_code != 200:
            failures.append(f"{method} {path}: {response.status_code} {response.text[:500]}")
            return None
        return response.json()

    check("GET", "/api/health")
    check("GET", "/api/postal-areas", params={"q": "00100"})
    check("GET", f"/api/market/{FLAT['postal_code']}")
    check("GET", f"/api/market/{FLAT['postal_code']}/history", params={"room_type": "two_room"})
    check("GET", "/api/rates")
    check("GET", "/api/map/values", params={"room_type": "two_room"})
    check("GET", "/api/map/trends", params={"room_type": "two_room"})
    start = check("GET", "/api/planner/start", params=FLAT)
    if start is not None:
        check("POST", "/api/planner/run", json=start["scenario"])

    if failures:
        print(f"\nThe code does not run on {warehouse}:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        print(
            "\nIf the code needs new seeds or models, run the monthly data refresh: it builds "
            "the warehouse from the production branch and then deploys it.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
