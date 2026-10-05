"""Write the map values and trends of each room type as static JSON for the website."""

import json
import sys
import typing
from pathlib import Path

from fastapi.encoders import jsonable_encoder

from asumisvalinta.config import REPO_ROOT

DEFAULT_OUTPUT = REPO_ROOT / "web" / "public" / "map"


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    output.mkdir(parents=True, exist_ok=True)

    from asumisvalinta.api import app

    for room_type in typing.get_args(app.RoomType):
        for name, data in (
            ("values", app.map_values(room_type)),
            ("trends", app.map_trends(room_type)),
        ):
            path = output / f"{name}-{room_type}.json"
            path.write_text(json.dumps(jsonable_encoder(data), separators=(",", ":")), "utf-8")
            print(f"Wrote {path} ({path.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
