"""Runtime settings read from environment variables and an optional .env file."""

import os
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_dotenv(path: Path = REPO_ROOT / ".env") -> None:
    """Set variables from a KEY=VALUE file without overriding the environment."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def duckdb_path() -> Path:
    """Location of the warehouse file. Override with ASUMISVALINTA_DUCKDB_PATH."""
    default = REPO_ROOT / "data" / "asumisvalinta.duckdb"
    return Path(os.environ.get("ASUMISVALINTA_DUCKDB_PATH", default))


def connect_read_only(path: Path | None = None) -> duckdb.DuckDBPyConnection:
    """Read-only connection with the same settings as the semantic layer's connection.

    DuckDB refuses a second connection to a file with different settings in one process.
    """
    return duckdb.connect(
        str(path or duckdb_path()), read_only=False, config={"access_mode": "READ_ONLY"}
    )
