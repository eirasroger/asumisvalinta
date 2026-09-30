"""Governed metrics checked against hand-computed values from the CI fixture warehouse.

The fixture must be loaded and built first (see .github/workflows/ci.yml).
"""

import datetime as dt

import pytest

from asumisvalinta.semantic import MetricQuery, SemanticLayer
from asumisvalinta.semantic.client import UnknownMetricError
from tests.warehouse import WAREHOUSE, requires_warehouse

pytestmark = requires_warehouse

POSTAL_00100 = "{{ Entity('postal_area') }} = '00100'"
BLOCKS_OF_FLATS = "{{ Dimension('dwelling_price__building_type') }} = 'block_of_flats'"
TWO_ROOM = "{{ Entity('room_type') }} = 'two_room'"


@pytest.fixture(scope="module")
def semantic_layer() -> SemanticLayer:
    return SemanticLayer(warehouse=WAREHOUSE)


def _single_value(semantic_layer: SemanticLayer, query: MetricQuery) -> float:
    result = semantic_layer.query(query)
    assert len(result.rows) == 1, result.rows
    return result.rows[0][-1]


def test_only_governed_metrics_are_listed(semantic_layer):
    names = {metric.name for metric in semantic_layer.list_metrics()}
    assert "avg_price_per_m2" in names
    assert "price_to_rent_ratio" in names
    assert "price_weighted_sum" not in names
    assert all(metric.description for metric in semantic_layer.list_metrics())


def test_unknown_metric_is_refused(semantic_layer):
    with pytest.raises(UnknownMetricError):
        semantic_layer.query(MetricQuery(metrics=("average_house_price",)))


def test_component_metric_is_refused(semantic_layer):
    with pytest.raises(UnknownMetricError):
        semantic_layer.query(MetricQuery(metrics=("price_weighted_sum",)))


def test_average_price_weights_room_types_by_transactions(semantic_layer):
    # 00100, 2025Q4, blocks of flats: one-room 7561 (62 sales), two-room 7257 (60),
    # three-room+ 7117 (38).
    # (7561 * 62 + 7257 * 60 + 7117 * 38) / 160 = 7341.55
    value = _single_value(
        semantic_layer,
        MetricQuery(
            metrics=("avg_price_per_m2",),
            group_by=("metric_time__quarter",),
            where=(
                POSTAL_00100,
                BLOCKS_OF_FLATS,
                "{{ TimeDimension('metric_time', 'quarter') }} = '2025-10-01'",
            ),
        ),
    )
    assert value == pytest.approx(7341.55, abs=0.01)


def test_transaction_count_sums_room_types(semantic_layer):
    value = _single_value(
        semantic_layer,
        MetricQuery(
            metrics=("transaction_count",),
            group_by=("metric_time__quarter",),
            where=(
                POSTAL_00100,
                BLOCKS_OF_FLATS,
                "{{ TimeDimension('metric_time', 'quarter') }} = '2025-10-01'",
            ),
        ),
    )
    assert value == 62 + 60 + 38


def test_price_to_rent_ratio_and_gross_yield(semantic_layer):
    # 00100 two-room: price 7167 €/m² (postal code, 2026Q1),
    # rent 25.14 €/m²/month (Helsinki 1, 2026Q2).
    result = semantic_layer.query(
        MetricQuery(
            metrics=("price_to_rent_ratio", "gross_rental_yield"),
            where=(POSTAL_00100, TWO_ROOM),
        )
    )
    ratio, gross_yield = result.rows[0]
    assert ratio == pytest.approx(7167 / (25.14 * 12))
    assert gross_yield == pytest.approx(25.14 * 12 * 100 / 7167)


def test_new_contract_rent_matches_published_value(semantic_layer):
    # Statistics Finland table 15fa: Helsinki, two-room, non-subsidised, new agreements, 2025Q1.
    value = _single_value(
        semantic_layer,
        MetricQuery(
            metrics=("avg_rent_per_m2_new_contracts",),
            group_by=("metric_time__quarter",),
            where=(
                "{{ Entity('area') }} = 'rent_area:091'",
                TWO_ROOM,
                "{{ TimeDimension('metric_time', 'quarter') }} = '2025-01-01'",
            ),
        ),
    )
    assert value == pytest.approx(21.06)


def test_mortgage_rate_matches_published_value(semantic_layer):
    # ECB series MIR.M.FI.B.A2C.A.R.A.2250.EUR.N, July 2026.
    result = semantic_layer.query(
        MetricQuery(
            metrics=("new_mortgage_rate",),
            group_by=("metric_time__month",),
            where=("{{ TimeDimension('metric_time', 'month') }} = '2026-07-01'",),
        )
    )
    assert result.rows == ((dt.datetime(2026, 7, 1), 3.18),)
