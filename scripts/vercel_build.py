"""Build step of the API on Vercel: fetch the serving warehouse and parse the dbt project.

The serving warehouse comes from the latest GitHub release. The dbt manifest must be
generated here because MetricFlow reads it at runtime and the target folder is not in git.
"""

import os
import shutil
import sys
import urllib.request
from pathlib import Path

from dbt.cli.main import dbtRunner

REPO_ROOT = Path(__file__).resolve().parents[1]
RELEASE_URL = (
    "https://github.com/eirasroger/asumisvalinta/releases/latest/download/"
    "asumisvalinta-serving.duckdb"
)
SERVING = REPO_ROOT / "serving" / "asumisvalinta.duckdb"


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as response, destination.open("wb") as file:
        shutil.copyfileobj(response, file)
    print(f"Downloaded {destination} ({destination.stat().st_size / 1e6:.1f} MB)")


def parse_dbt() -> None:
    os.environ["ASUMISVALINTA_DUCKDB_PATH"] = str(SERVING)
    dbt_dir = str(REPO_ROOT / "dbt")
    result = dbtRunner().invoke(["parse", "--project-dir", dbt_dir, "--profiles-dir", dbt_dir])
    if not result.success:
        sys.exit("dbt parse failed")


def main() -> None:
    download(os.environ.get("ASUMISVALINTA_SERVING_URL", RELEASE_URL), SERVING)
    parse_dbt()


if __name__ == "__main__":
    main()
