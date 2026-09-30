# asumisvalinta

Rent, right of occupancy (asumisoikeus) or buy a flat in Finland? Asumisvalinta compares the three over the years you plan to stay, using official open data for every area of the country and the numbers of the flats you are looking at.

- **Explore** a map of all 3,018 postal code areas, coloured by price, rent or price-to-rent ratio.
- **Compare** the three options for one flat. Each input starts at the market value for the area, size and building age, and shows how your own figure differs from the market.
- **Ask** questions about the housing market in plain language. An assistant answers only with governed metrics and says which data it used.

## Stack

| Layer | Tools | What it does |
|---|---|---|
| Ingestion | dlt, Python | Loads Statistics Finland (PxWeb API), the ECB (SDMX API) and Paavo postal areas into DuckDB. Tables reload only when the source publishes an update. |
| Warehouse | DuckDB, Snowflake | DuckDB for development, CI and serving. The same dbt project also runs on Snowflake as a second target. |
| Transformation | dbt | Staging, intermediate and mart models with tests, seeds for tax rules and assumptions, and a snapshot that keeps revised figures. SQL stays portable through dbt cross-database macros. |
| Semantic layer | MetricFlow | Governed metrics such as price per m², rent per m², price change and interest rates, queried with dimensions and filters instead of raw SQL. |
| Scenario engine | Python, Pydantic | Month-by-month cash flows, loans, Finnish capital income tax rules and break-even. All arithmetic is deterministic and tested against hand calculations. |
| Agent | OpenAI-compatible API | Answers questions through tools that call the semantic layer and the scenario engine. Every number in an answer must come from a tool result. |
| Evaluation | pytest, YAML golden set | 58 questions with reference answers computed from the warehouse. The governed agent is scored against a text-to-SQL baseline. |
| API | FastAPI | Serves market data, scenario runs and the agent from a read-only copy of the warehouse. |
| Front end | Next.js, TypeScript, Tailwind CSS, MapLibre, ECharts, Radix UI | Map, comparison and question pages. |
| Delivery | GitHub Actions, Vercel | CI on every push, a monthly data refresh that publishes a release, and deployment of the web app and API to Vercel. |

```mermaid
flowchart LR
    SF[Statistics Finland] --> DLT[dlt]
    ECB[ECB] --> DLT
    DLT --> RAW[(DuckDB raw)]
    RAW --> DBT[dbt models and tests]
    SEEDS[Tax rules and assumptions] --> DBT
    DBT --> MARTS[(Marts)]
    MARTS --> MF[MetricFlow]
    MARTS --> ENGINE[Scenario engine]
    MF --> AGENT[Agent]
    ENGINE --> AGENT
    MARTS --> API[FastAPI]
    ENGINE --> API
    AGENT --> API
    API --> WEB[Next.js on Vercel]
```

## Design decisions

- **Official data first, with the level shown.** When a postal code has no published figure, the value comes from the nearest larger area that has one, and the app marks it.
- **Assumptions are visible and editable.** Tax rules and default assumptions live in dbt seeds with a source URL and a retrieval date.
- **The model computes, the language model does not.** The agent reaches data only through the semantic layer and the scenario engine, and an answer is rejected when its number is not in a tool result.
- **Right of occupancy is compared locally.** Charges and fees of sampled right-of-occupancy buildings are expressed relative to the market rent and price where each building stands, and applied to the chosen area.
- **One data release a month.** The monthly workflow restores the previous warehouse, loads new data, runs dbt and the evaluation checks, and publishes the warehouse, dbt documentation and map as a GitHub release that the website builds from.

## Evaluation

The golden set in `evals/golden_set.yaml` holds 58 questions on prices, rents, interest rates and scenarios, each with a reference computation. In the latest full run the governed agent answered 84.5 % correctly against 72.4 % for the text-to-SQL baseline; for metric questions alone the scores were 85 % and 62.5 %.

## Run it locally

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), and Node.js 24.

```bash
uv sync --all-groups
cp .env.example .env            # add an API key only if you use the agent

uv run asumisvalinta-ingest     # load all sources into data/asumisvalinta.duckdb
uv run dbt build --project-dir dbt --profiles-dir dbt

uv run uvicorn asumisvalinta.api.app:app --port 8000
cd web && npm install && npm run build:map
API_ORIGIN=http://127.0.0.1:8000 npm run dev
```

Tests run against a small fixture warehouse built from `fixtures/`:

```bash
export ASUMISVALINTA_DUCKDB_PATH=data/fixture/asumisvalinta.duckdb
uv run python scripts/load_fixture.py
uv run dbt build --project-dir dbt --profiles-dir dbt --vars '{min_postal_codes_per_quarter: 1}'
uv run pytest
uv run asumisvalinta-eval --agent semantic --limit 10   # needs an API key
```

## Repository layout

```
src/asumisvalinta/   ingestion, semantic layer client, scenario engine, agent, evaluation, API
dbt/                 models, seeds, snapshot, tests and the semantic layer definitions
web/                 Next.js front end
evals/               golden question set
fixtures/            raw data slice for CI
content/             methodology shown in the app
```

## Data and licence

Source: Statistics Finland (licence CC BY 4.0), including Paavo postal code areas. Source: ECB statistics. Tax and lending rules from the Finnish Tax Administration, the Ministry of Finance, the State Treasury, Finlex and the Financial Supervisory Authority. Right-of-occupancy sample from public Asuntosäätiö listings. Map tiles by OpenFreeMap, data from OpenStreetMap.

The code is licensed under the PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE).
