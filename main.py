"""Entrypoint of the API service on Vercel, which serves the ASGI `app` defined here."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from asumisvalinta.api.app import app

__all__ = ["app"]
