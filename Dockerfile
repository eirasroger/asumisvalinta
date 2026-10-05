# Needs serving/ and dbt/target/ from scripts/build_serving.py.
FROM python:3.12-slim-trixie

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    ASUMISVALINTA_DUCKDB_PATH=/app/serving/asumisvalinta.duckdb

WORKDIR /app

COPY pyproject.toml uv.lock README.md LICENSE ./
RUN --mount=from=ghcr.io/astral-sh/uv:0.12.1,source=/uv,target=/bin/uv \
    uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN --mount=from=ghcr.io/astral-sh/uv:0.12.1,source=/uv,target=/bin/uv \
    uv sync --locked --no-dev

COPY dbt/target/semantic_manifest.json ./dbt/target/semantic_manifest.json
COPY serving/asumisvalinta.duckdb ./serving/asumisvalinta.duckdb

RUN useradd --system --create-home api
USER api

CMD ["sh", "-c", "exec uvicorn asumisvalinta.api.app:app --host 0.0.0.0 --port ${PORT:-8080} --no-server-header"]
