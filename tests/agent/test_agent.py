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
    model = ScriptedModel(
        [
            call(
                "submit_answer",
                {
                    "status": "refused",
                    "answer": "no",
                    "value": None,
                    "unit": None,
                    "sources": "none",
                },
            )
        ]
    )
    run = Agent("test", "system", [answer_tool()], model).run("question")
    assert run.status == "refused"
    assert run.value is None
    assert (run.prompt_tokens, run.completion_tokens) == (100, 10)
    assert [c.tool for c in run.tool_calls] == ["submit_answer"]


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
    refused = Agent("a", "s", [answer_tool()], ScriptedModel([submit("refused", None)])).run("?")
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
    model = ScriptedModel([submit("refused", None)])
    assert Agent("test", "system", [answer_tool()], model).run("?").status == "refused"
