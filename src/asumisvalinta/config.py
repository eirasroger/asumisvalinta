"""Runtime settings read from environment variables."""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def duckdb_path() -> Path:
    """Location of the warehouse file. Override with ASUMISVALINTA_DUCKDB_PATH."""
    default = REPO_ROOT / "data" / "asumisvalinta.duckdb"
    return Path(os.environ.get("ASUMISVALINTA_DUCKDB_PATH", default))
