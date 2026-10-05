"""Agent loop, tools and grading, driven by a scripted model instead of a real one."""

import json
from dataclasses import dataclass, field
from typing import Any

import pytest

from asumisvalinta.agent import Agent, AgentRun, baseline_agent, semantic_agent
from asumisvalinta.agent.llm import ChatResponse, ToolCall
from asumisvalinta.agent.tools import ToolError, answer_tool, sql_tools
from asumisvalinta.evaluation.golden import GoldenQuestion, Tolerance, load_golden_set
from asumisvalinta.evaluation.grading import grade, summarise
from asumisvalinta.semantic import Filter
from tests.warehouse import WAREHOUSE, requires_warehouse


@dataclass
class ScriptedModel:
    responses: list[ChatResponse]
    name: str = "scripted"
    seen: list[list[dict[str, Any]]] = field(default_factory=list)

    def complete(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ChatResponse:
        self.seen.append(list(messages))
        return self.responses.pop(0)


def call(name: str, arguments: dict[str, Any], call_id: str = "1") -> ChatResponse:
    return ChatResponse(
        content=None,
        tool_calls=(ToolCall(call_id, name, json.dumps(arguments)),),
        prompt_tokens=100,
        completion_tokens=10,
    )


def submit(status: str = "answered", value: float | None = None) -> ChatResponse:
    return call(
        "submit_answer",
        {"status": status, "answer": "text", "value": value, "unit": None, "sources": "test"},
        call_id="final",
    )


def test_submit_answer_ends_the_run_and_sums_tokens():
    model = ScriptedModel([call("no_such_tool", {}), submit(value=None)])
    run = Agent("test", "system", [answer_tool()], model).run("question")
    assert run.status == "answered"
    assert (run.prompt_tokens, run.completion_tokens) == (200, 20)
    assert [c.tool for c in run.tool_calls] == ["no_such_tool", "submit_answer"]


@pytest.mark.parametrize("status", ["refused", "needs_clarification"])
def test_refusal_before_any_tool_is_sent_back_once(status):
    model = ScriptedModel([submit(status), submit(status)])
    run = Agent("test", "system", [answer_tool()], model).run("question")
    assert run.status == status
    assert [c.ok for c in run.tool_calls] == [False, True]
    assert "Look the question up" in run.tool_calls[0].result


def test_tool_errors_go_back_to_the_model():
    model = ScriptedModel([call("no_such_tool", {}), submit()])
    run = Agent("test", "system", [answer_tool()], model).run("question")
    assert run.tool_calls[0].ok is False
    assert "Unknown tool" in run.tool_calls[0].result
    assert run.status == "answered"
    tool_message = model.seen[1][-1]
    assert tool_message["role"] == "tool" and "error" in tool_message["content"]


def test_plain_text_reply_gets_one_reminder():
    model = ScriptedModel([ChatResponse(content="42"), ChatResponse(content="Still 42")])
    run = Agent("test", "system", [answer_tool()], model).run("question")
    assert run.status == "answered"
    assert run.answer == "Still 42"
    assert run.value is None


def test_run_stops_after_the_step_limit():
    model = ScriptedModel([call("no_such_tool", {}) for _ in range(3)])
    run = Agent("test", "system", [answer_tool()], model, max_steps=3).run("question")
    assert run.error == "No answer after 3 steps"


@pytest.mark.parametrize(
    "query",
    ["delete from marts.dim_room_type", "select 1; drop table marts.dim_room_type", "pragma x"],
)
def test_sql_tool_only_runs_single_selects(query):
    run_sql = next(tool for tool in sql_tools(WAREHOUSE) if tool.name == "run_sql")
    with pytest.raises(ToolError):
        run_sql.handler(query=query)


def _question(kind: str) -> GoldenQuestion:
    reference = {"metrics": ["avg_price_per_m2"]} if kind == "metric" else None
    return GoldenQuestion(id="q", question="?", kind=kind, reference=reference)


def test_grading_within_tolerance():
    run = AgentRun(agent="a", model="m", question="?", status="answered", value=100.4)
    assert grade(_question("metric"), run, 100.0, Tolerance(relative=0.005)).correct
    assert not grade(_question("metric"), run, 100.0, Tolerance(relative=0.001)).correct


def test_grading_refusals_and_status_mismatch():
    model = ScriptedModel([submit("refused", None), submit("refused", None)])
    refused = Agent("a", "s", [answer_tool()], model).run("?")
    assert grade(_question("refusal"), refused, None, Tolerance()).correct
    wrong = grade(_question("metric"), refused, 100.0, Tolerance(relative=0.01))
    assert not wrong.correct
    assert summarise([wrong])["a"]["answerable_questions_refused"] == 1


def test_golden_set_is_large_and_covers_every_kind():
    questions = load_golden_set().questions
    assert len(questions) >= 50
    assert {q.kind for q in questions} == {"metric", "scenario", "refusal", "clarification"}


class TestWithWarehouse:
    pytestmark = requires_warehouse

    def test_semantic_agent_answers_through_metricflow(self):
        filters = [
            {"field": "postal_area", "operator": "=", "value": "00100"},
            {"field": "dwelling_price__building_type", "operator": "=", "value": "block_of_flats"},
            {"field": "metric_time__quarter", "operator": "=", "value": "2025-10-01"},
        ]
        model = ScriptedModel(
            [
                call("list_metrics", {}),
                call(
                    "query_metrics",
                    {
                        "metrics": ["avg_price_per_m2"],
                        "group_by": ["metric_time__quarter"],
                        "filters": filters,
                    },
                ),
                submit(value=7341.55),
            ]
        )
        run = semantic_agent(model, WAREHOUSE).run("Price in 00100 in 2025 Q4?")
        assert [c.tool for c in run.tool_calls] == [
            "list_metrics",
            "query_metrics",
            "submit_answer",
        ]
        query_result = json.loads(run.tool_calls[1].result)
        assert query_result["rows"][0][1] == pytest.approx(7341.55)

    def test_system_prompt_lists_every_governed_metric(self):
        from asumisvalinta.semantic import SemanticLayer

        names = [metric.name for metric in SemanticLayer(warehouse=WAREHOUSE).list_metrics()]
        prompt = semantic_agent(ScriptedModel([]), WAREHOUSE).system_prompt
        assert all(f"- {name} (" in prompt for name in names)

    def test_unknown_metric_is_reported_to_the_model(self):
        model = ScriptedModel(
            [call("query_metrics", {"metrics": ["euribor_12m"]}), submit("refused", None)]
        )
        run = semantic_agent(model, WAREHOUSE).run("Euribor?")
        assert run.tool_calls[0].ok is False
        assert "Unknown metrics" in run.tool_calls[0].result

    def test_baseline_agent_runs_read_only_sql(self):
        model = ScriptedModel(
            [
                call("run_sql", {"query": "select count(*) from marts.dim_room_type"}),
                submit(value=4),
            ]
        )
        run = baseline_agent(model, WAREHOUSE).run("How many room types?")
        assert json.loads(run.tool_calls[0].result)["rows"] == [[4]]

    def test_scenario_tool_returns_all_options(self):
        model = ScriptedModel(
            [
                call(
                    "run_scenario",
                    {
                        "postal_code": "00100",
                        "room_type": "two_room",
                        "size_m2": 55,
                        "horizon_years": 5,
                        "overrides": {"interest_rate": 0.05},
                    },
                ),
                submit(),
            ]
        )
        run = semantic_agent(model, WAREHOUSE).run("Buy or rent?")
        result = json.loads(run.tool_calls[0].result)
        assert set(result["options"]) == {"buy", "rent", "aso"}
        assert result["inputs"]["interest_rate"] == 0.05


def test_filters_render_metricflow_syntax():
    assert Filter("postal_area", "=", "00100").to_where() == "{{ Entity('postal_area') }} = '00100'"
    assert (
        Filter("dwelling_price__building_type", "!=", "all").to_where()
        == "{{ Dimension('dwelling_price__building_type') }} != 'all'"
    )
    assert (
        Filter("metric_time__quarter", ">=", "2025-01-01").to_where()
        == "{{ TimeDimension('metric_time', 'quarter') }} >= '2025-01-01'"
    )
    assert (
        Filter("room_type", "in", ["one_room", "two_room"]).to_where()
        == "{{ Entity('room_type') }} in ('one_room', 'two_room')"
    )
    assert Filter("area", "=", "x' or '1'='1").to_where() == (
        "{{ Entity('area') }} = 'x'' or ''1''=''1'"
    )
    with pytest.raises(ValueError):
        Filter("area", "like", "x").to_where()


@pytest.mark.parametrize(
    "field",
    [
        "room_type') }} = 'x' or 1 = 1 or {{ Dimension('room_type",
        "postal_area__municipality_name; select 1",
        "Room_Type",
    ],
)
def test_filter_fields_must_be_plain_names(field):
    with pytest.raises(ValueError, match="Invalid field"):
        Filter(field, "=", "x").to_where()


@pytest.fixture(scope="module")
def tools():
    agent = semantic_agent(ScriptedModel([]), WAREHOUSE)
    return {tool.name: tool.handler for tool in agent.tools}


class TestLookupsWithWarehouse:
    pytestmark = requires_warehouse

    def test_dimension_values_list_the_building_types(self, tools):
        values = tools["list_dimension_values"](
            metrics=["avg_price_per_m2"], dimension="dwelling_price__building_type"
        )
        assert values == ["all", "block_of_flats", "terraced_house"]

    def test_search_areas_finds_helsinki(self, tools):
        result = tools["search_areas"](text="Helsinki")
        keys = {area["area"] for area in result["areas"]}
        assert {"price_area:091", "rent_area:091", "rent_area:091_1"} <= keys
        assert any(area["postal_area"] == "00100" for area in result["postal_areas"])

    def test_empty_result_comes_with_a_hint(self, tools):
        result = tools["query_metrics"](
            metrics=["avg_price_per_m2"],
            filters=[
                {"field": "postal_area", "operator": "=", "value": "00100"},
                {"field": "dwelling_price__building_type", "operator": "=", "value": "blocks"},
            ],
        )
        assert "note" in result

    def test_price_spread_gives_quartiles_and_the_cheapest_and_dearest_areas(self, tools):
        spread = tools["price_spread"](area="municipality_2015:091")
        prices = spread["prices_per_m2"]
        all_flats = next(row for row in prices["by_flat"] if row["flat"] == "all flats")
        assert all_flats["lower_quartile"] < all_flats["median"] < all_flats["upper_quartile"]
        cheapest = prices["cheapest_postal_area"]["average_price_per_m2"]
        assert cheapest <= prices["most_expensive_postal_area"]["average_price_per_m2"]
        assert spread["monthly_rents"]["area"] == "rent_area:091"

    def test_price_spread_reports_areas_without_quartiles(self, tools):
        with pytest.raises(ToolError, match="No published quartiles"):
            tools["price_spread"](area="municipality_2015:020")

    def test_room_type_values_are_listed_without_a_query(self, tools):
        values = tools["list_dimension_values"](metrics=["avg_price_per_m2"], dimension="room_type")
        assert values == ["one_room", "two_room", "three_room_plus", "all"]

    def test_area_totals_and_details_cannot_be_added_together(self, tools):
        with pytest.raises(ToolError, match="room_type"):
            tools["query_metrics"](
                metrics=["transaction_count"],
                filters=[
                    {"field": "area", "operator": "=", "value": "price_area:SSS"},
                    {
                        "field": "dwelling_price__building_type",
                        "operator": "=",
                        "value": "block_of_flats",
                    },
                    {"field": "metric_time__quarter", "operator": "=", "value": "2025Q4"},
                ],
            )

    def test_published_total_is_used_when_room_type_is_all(self, tools):
        result = tools["query_metrics"](
            metrics=["transaction_count"],
            filters=[
                {"field": "area", "operator": "=", "value": "price_area:SSS"},
                {"field": "room_type", "operator": "=", "value": "all"},
                {
                    "field": "dwelling_price__building_type",
                    "operator": "=",
                    "value": "block_of_flats",
                },
                {"field": "metric_time__quarter", "operator": "=", "value": "2025Q4"},
            ],
        )
        assert result["rows"][0][1] == 10947

    def test_postal_code_queries_average_over_room_types(self, tools):
        result = tools["query_metrics"](
            metrics=["avg_price_per_m2"],
            filters=[
                {"field": "postal_area", "operator": "=", "value": "00100"},
                {
                    "field": "dwelling_price__building_type",
                    "operator": "=",
                    "value": "block_of_flats",
                },
                {"field": "metric_time__quarter", "operator": "=", "value": "2025-10-01"},
            ],
        )
        assert result["rows"][0][1] == pytest.approx(7341.55)

    def test_queries_cannot_read_files_or_change_settings(self):
        import duckdb

        from asumisvalinta.config import connect_read_only

        with connect_read_only(WAREHOUSE) as connection:
            with pytest.raises(duckdb.Error):
                connection.execute("select content from read_text('pyproject.toml')")
            with pytest.raises(duckdb.Error):
                connection.execute("set enable_external_access = true")

    def test_rank_areas_orders_postal_codes_by_price(self, tools):
        result = tools["rank_areas"](measure="price", level="postal_code", order="highest", years=2)
        values = [row["value"] for row in result["rows"]]
        assert len(values) == 5
        assert values == sorted(values, reverse=True)
        assert result["rows"][0]["municipality_name"] == "Helsinki"
        assert " to " in result["period"]

    def test_rank_areas_lowest_rents_by_municipality(self, tools):
        result = tools["rank_areas"](
            measure="rent", level="municipality", order="lowest", room_type="one_room", limit=3
        )
        values = [row["value"] for row in result["rows"]]
        assert values == sorted(values)
        assert all(row["area"].startswith("rent_area:") for row in result["rows"])

    def test_rank_areas_within_a_municipality(self, tools):
        result = tools["rank_areas"](
            measure="price", level="postal_code", order="lowest", within="espoo", limit=20
        )
        assert result["rows"]
        assert {row["municipality_name"] for row in result["rows"]} == {"Espoo"}
        assert result["ranked_among"].endswith("in espoo")

    def test_rank_areas_reports_differences_from_the_shown_values(self, tools):
        result = tools["rank_areas"](
            measure="price", level="postal_code", order="highest", within="helsinki", limit=2
        )
        top, second = result["rows"]
        assert top["difference_to_next"] == top["value"] - second["value"]
        assert top["difference_to_other_end"] == top["value"] - result["other_end"]["value"]
        assert top["percent_vs_median"] > 0
        assert "difference_to_next" not in result["other_end"]

    def test_area_prices_lists_every_flat_size(self, tools):
        result = tools["area_prices"](postal_code="00100")
        assert result["municipality"] == "Helsinki"
        flats = {row["flat"]: row for row in result["by_room_type"]}
        assert set(flats) == {"studio", "1 bedroom", "2+ bedrooms"}
        assert all(row["rent_per_m2_month"] > 0 for row in flats.values())

    def test_area_prices_reports_unknown_postal_codes(self, tools):
        with pytest.raises(ToolError, match="search_areas"):
            tools["area_prices"](postal_code="99999")

    def test_rank_areas_rejects_levels_without_data(self, tools):
        with pytest.raises(ToolError, match="rents rank by"):
            tools["rank_areas"](measure="rent", level="postal_code", order="highest")

    def test_offset_metric_values_come_from_its_inputs(self, tools):
        values = tools["list_dimension_values"](
            metrics=["price_index_yoy_change"], dimension="price_index_observation__building_type"
        )
        assert "block_of_flats" in values


def test_time_values_are_normalised():
    from asumisvalinta.semantic.client import normalise_time

    assert normalise_time("2024") == "2024-01-01"
    assert normalise_time("2025Q4") == "2025-10-01"
    assert normalise_time("2023-07") == "2023-07-01"
    assert normalise_time("2025-10-01 00:00:00") == "2025-10-01"


def _echo_tool():
    from asumisvalinta.agent.tools import Tool

    return Tool(
        name="echo",
        description="",
        parameters={"type": "object", "properties": {}},
        handler=lambda: {"rows": [[3.02], [3.28], [3.935]]},
    )


def test_numeric_answer_must_come_from_a_tool_result():
    model = ScriptedModel([call("echo", {}), submit(value=3.77), submit(value=3.94)])
    run = Agent("test", "system", [_echo_tool(), answer_tool()], model).run("?")
    rejected = run.tool_calls[1]
    assert rejected.ok is False and "does not appear" in rejected.result
    assert run.value == 3.94  # 3.935 rounded to two decimals is accepted


def test_answer_without_a_number_needs_no_tool_result():
    model = ScriptedModel([submit("answered", None)])
    assert Agent("test", "system", [answer_tool()], model).run("?").status == "answered"


def test_earlier_turns_come_before_the_question():
    model = ScriptedModel([submit()])
    history = [("Price in 00100?", "About 7,800 € per m²."), ("And rents?", "About 25 € per m².")]
    Agent("test", "system", [answer_tool()], model).run("And in Espoo?", history)
    roles = [(message["role"], message["content"]) for message in model.seen[0]]
    assert roles == [
        ("system", "system"),
        ("user", "Price in 00100?"),
        ("assistant", "About 7,800 € per m²."),
        ("user", "And rents?"),
        ("assistant", "About 25 € per m²."),
        ("user", "And in Espoo?"),
    ]
