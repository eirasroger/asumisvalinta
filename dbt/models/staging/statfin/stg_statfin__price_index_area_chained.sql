select
    'quarter' as period_grain,
    {{ period_start_date('period', 'quarter') }} as period_start_date,
    period as period_label,
    price_area as area_code,
    price_area_label as area_name,
    {{ area_level('price_area') }} as area_level,
    {{ price_area_building_type('building_type') }} as building_type,
    {{ price_area_room_type('room_type') }} as room_type,
    price_index_1983,
    price_index_2000,
    price_index_2005,
    price_index_2010,
    price_index_2015,
    price_index_2020,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'price_index_area_chained') }}
