"""dlt source for Statistics Finland StatFin tables.

A table is reloaded only when its `updated` timestamp changes. A reload
replaces all rows of that table, so revised figures overwrite earlier values.
"""

from collections.abc import Iterator
from typing import Any

import dlt

from asumisvalinta.ingestion import pxweb
from asumisvalinta.ingestion.pxweb import PxTable

_POSTAL_PRICE_DIMS = {
    "postinumeroalue_4_20220101": "postal_code",
    "talotyyppi_6_20131021": "building_room_type",
}
_POSTAL_PRICE_CONTENTS = {
    "keskihinta_aritm_nw": "price_per_m2",
    "lkm_julk20": "transaction_count",
}
_AREA_PRICE_DIMS = {
    "alue_43_20260625": "price_area",
    "talotyyppi_5_20111209": "building_type",
    "huoneluku_1_20111212": "room_type",
}

TABLES: tuple[PxTable, ...] = (
    PxTable(
        name="prices_postal_quarterly",
        database="StatFin",
        subject="ashi",
        table_file="13mt.px",
        time_dimension="timeperiod_q",
        content_dimension="contentscode",
        dimensions={"timeperiod_q": "period", **_POSTAL_PRICE_DIMS},
        contents=_POSTAL_PRICE_CONTENTS,
    ),
    PxTable(
        name="prices_postal_yearly",
        database="StatFin",
        subject="ashi",
        table_file="13mu.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={"timeperiod_y": "period", **_POSTAL_PRICE_DIMS},
        contents=_POSTAL_PRICE_CONTENTS,
    ),
    PxTable(
        name="prices_municipality_yearly",
        database="StatFin",
        subject="ashi",
        table_file="13mx.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_y": "period",
            "kunta_1_20150101": "municipality_code",
            "talotyyppi_5_20111209": "building_type",
        },
        contents={
            "keskihinta_aritm_nw": "price_per_m2",
            "lkm_julk19": "transaction_count_until_2019",
            "lkm_julk20": "transaction_count",
        },
    ),
    PxTable(
        name="price_index_area_quarterly",
        database="StatFin",
        subject="ashi",
        table_file="15is.px",
        time_dimension="timeperiod_q",
        content_dimension="contentscode",
        dimensions={"timeperiod_q": "period", **_AREA_PRICE_DIMS},
        contents={
            "ashivq_indeksi_2025": "price_index_2025",
            "ashivq_indeksi_nmuutos_2025": "price_index_quarterly_change_pct",
            "ashivq_indeksi_vmuutos_2025": "price_index_annual_change_pct",
            "ashivq_keskineliohinta": "price_per_m2",
            "ashivq_kauppamaara_vvero": "transaction_count",
        },
    ),
    PxTable(
        name="price_index_area_chained",
        database="StatFin",
        subject="ashi",
        table_file="15it.px",
        time_dimension="timeperiod_q",
        content_dimension="contentscode",
        dimensions={"timeperiod_q": "period", **_AREA_PRICE_DIMS},
        contents={
            "ashivq_indeksi_1970": "price_index_1970",
            "ashivq_indeksi_1983": "price_index_1983",
            "ashivq_indeksi_2000": "price_index_2000",
            "ashivq_indeksi_2005": "price_index_2005",
            "ashivq_indeksi_2010": "price_index_2010",
            "ashivq_indeksi_2015": "price_index_2015",
            "ashivq_indeksi_2020": "price_index_2020",
        },
    ),
    PxTable(
        name="rents_postal_quarterly_2015",
        database="StatFin_Passiivi",
        subject="asvu",
        table_file="statfinpas_asvu_pxt_13eb_2025q4.px",
        time_dimension="Vuosineljännes",
        content_dimension="Tiedot",
        dimensions={
            "Vuosineljännes": "period",
            "Postinumero": "postal_code",
            "Huoneluku": "room_type",
        },
        contents={"keskivuokra": "rent_per_m2", "lkm_ptno": "observation_count"},
    ),
    PxTable(
        name="rents_area_quarterly_2015",
        database="StatFin_Passiivi",
        subject="asvu",
        table_file="statfinpas_asvu_pxt_11x4_2025q4.px",
        time_dimension="Vuosineljännes",
        content_dimension="Tiedot",
        dimensions={
            "Vuosineljännes": "period",
            "Alue": "rent_area",
            "Huoneluku": "room_type",
            "Rahoitusmuoto": "funding_type",
        },
        contents={
            "ketj_Tor": "rent_index_2015",
            "neljmuut": "rent_index_quarterly_change_pct",
            "vmuut": "rent_index_annual_change_pct",
            "lkm": "number",
            "keskivuokra": "rent_per_m2",
            "lkm_khinta": "observation_count",
            "keskivuokra_uudet": "rent_per_m2_new_contracts",
            "lkm_khinta_uudet": "observation_count_new_contracts",
        },
    ),
    PxTable(
        name="rents_area_quarterly",
        database="StatFin",
        subject="asvu",
        table_file="15fa.px",
        time_dimension="timeperiod_q",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_q": "period",
            "rahoitus_2_20260101": "funding_type",
            "huoneluku_5_20260101": "room_type",
            "alue_44_20260101": "rent_area",
        },
        contents={
            "asvu2025": "rent_index_2025",
            "asvu2025_nm": "rent_index_quarterly_change_pct",
            "asvu2025_vm": "rent_index_annual_change_pct",
            "asvu_keskineliovuokra": "rent_per_m2",
            "asvu_keskineliovuokra_lkm": "observation_count",
            "asvu_keskineliovuokra_u": "rent_per_m2_new_contracts",
            "asvu_keskineliovuokra_u_lkm": "observation_count_new_contracts",
        },
    ),
    PxTable(
        name="building_cost_index_monthly",
        database="StatFin",
        subject="rki",
        table_file="13g8.px",
        time_dimension="timeperiod_m",
        content_dimension="contentscode",
        dimensions={"timeperiod_m": "period", "perusv_1_20180101": "base_year"},
        contents={
            "rki-pisteluku": "index_value",
            "rki-muutos_edelliseen": "monthly_change_pct",
            "rki-vuosimuutos": "annual_change_pct",
        },
    ),
    PxTable(
        name="housing_company_finances_yearly",
        database="StatFin",
        subject="asyta",
        table_file="15gj.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_y": "period",
            "vast_vaihtoehdo_242_20130101": "company_type",
            "Tuloslaskelma_3_20220310": "account_item",
            "alue_3_20181009": "finance_area",
        },
        contents={"tuloslaskelmaeran_arvo": "value_cents_per_m2_month"},
    ),
    PxTable(
        name="housing_company_finances_yearly_2009",
        database="StatFin_Passiivi",
        subject="asyta",
        table_file="13jx_2024.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_y": "period",
            "Tuloslaskelma_3_20220310": "account_item",
            "talotyyppi_5_20111209": "building_type",
            "alue_3_20181009": "finance_area",
        },
        contents={"asyta-arvo": "value_cents_per_m2_month"},
    ),
    PxTable(
        name="price_distribution_area_quarterly",
        database="StatFin",
        subject="ashi",
        table_file="15iv.px",
        time_dimension="timeperiod_q",
        content_dimension="contentscode",
        dimensions={"timeperiod_q": "period", **_AREA_PRICE_DIMS},
        contents={
            "ashivq_neliohinta_alakvartiili": "price_per_m2_lower_quartile",
            "ashivq_neliohinta_mediaani": "price_per_m2_median",
            "ashivq_neliohinta_ylakvartiili": "price_per_m2_upper_quartile",
        },
    ),
    PxTable(
        name="rent_distribution_area_quarterly",
        database="StatFin",
        subject="asvu",
        table_file="15fc.px",
        time_dimension="timeperiod_q",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_q": "period",
            "huoneluku_5_20260101": "room_type",
            "alue_44_20260101": "rent_area",
        },
        contents={
            "asvu_jakauma_lkm": "observation_count",
            "asvu_q1": "rent_lower_quartile",
            "asvu_mediaani": "rent_median",
            "asvu_q3": "rent_upper_quartile",
        },
    ),
    PxTable(
        name="housing_company_finances_by_age_yearly",
        database="StatFin",
        subject="asyta",
        table_file="15gi.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_y": "period",
            "vast_vaihtoehdo_242_20130101": "company_type",
            "rak_valm_v_20_20201229": "construction_period",
            "Tuloslaskelma_3_20220310": "account_item",
        },
        contents={"tuloslaskelmaeran_arvo": "value_cents_per_m2_month"},
    ),
    PxTable(
        name="owner_renovation_costs_yearly",
        database="StatFin",
        subject="kora",
        table_file="15gd.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={
            "timeperiod_y": "period",
            "rakennusosa_2_20080201": "structure_element",
            "vast_vaihtoehdo_243_20130101": "dwelling_type",
        },
        contents={
            "omas_korjauskustannukset": "renovation_costs_eur_million",
            "omas_korjauskustannukset_per_m2": "renovation_costs_eur_per_m2",
        },
    ),
    PxTable(
        name="consumer_price_index_yearly",
        database="StatFin",
        subject="khi",
        table_file="11xt.px",
        time_dimension="timeperiod_y",
        content_dimension="contentscode",
        dimensions={"timeperiod_y": "period", "indeksisarja_1_20160101": "index_series"},
        contents={"Pisteluku": "index_value"},
        selection={"indeksisarja_1_20160101": ["0_2015"]},
    ),
)


def column_hints(table: PxTable) -> dict[str, dict[str, Any]]:
    """Explicit column types, so every column exists with a stable type."""
    hints: dict[str, dict[str, Any]] = {}
    for column in table.dimensions.values():
        hints[column] = {"data_type": "text", "nullable": False}
        hints[f"{column}_label"] = {"data_type": "text"}
    for column in table.contents.values():
        hints[column] = {"data_type": "double"}
        hints[f"{column}_status"] = {"data_type": "text"}
    hints["is_preliminary"] = {"data_type": "bool"}
    hints["source_table"] = {"data_type": "text", "nullable": False}
    hints["table_updated"] = {"data_type": "timestamp"}
    return hints


def _table_resource(table: PxTable, force: bool) -> Any:
    @dlt.resource(
        name=table.name,
        write_disposition={"disposition": "merge", "strategy": "delete-insert"},
        merge_key="source_table",
        columns=column_hints(table),
    )
    def rows() -> Iterator[dict[str, Any]]:
        state = dlt.current.resource_state()
        updated = pxweb.table_updated(table)
        if not force and state.get("updated") == updated:
            return
        source_table = f"{table.database}/{table.subject}/{table.table_file}"
        for row in pxweb.fetch_rows(table):
            row["source_table"] = source_table
            row["table_updated"] = updated
            yield row
        state["updated"] = updated

    return rows


@dlt.source(name="statfin")
def statfin_source(force: bool = False) -> Any:
    """All StatFin tables. `force=True` reloads tables whose timestamp is unchanged."""
    return [_table_resource(table, force) for table in TABLES]
