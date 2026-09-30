select
    'price_area' as area_scheme,
    area_code,
    area_level as geography_level,
    period_grain,
    period_start_date,
    period_label,
    building_type,
    room_type,
    price_index_1983,
    price_index_2000,
    price_index_2005,
    price_index_2010,
    price_index_2015,
    price_index_2020,
    is_preliminary,
    source_table
from {{ ref('stg_statfin__price_index_area_chained') }}
