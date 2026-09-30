select
    'quarter' as period_grain,
    {{ period_start_date('period', 'quarter') }} as period_start_date,
    period as period_label,
    price_area as area_code,
    price_area_label as area_name,
    {{ area_level('price_area') }} as area_level,
    {{ price_area_building_type('building_type') }} as building_type,
    {{ price_area_room_type('room_type') }} as room_type,
    price_per_m2,
    cast(transaction_count as integer) as transaction_count,
    price_index_2025,
    price_index_quarterly_change_pct,
    price_index_annual_change_pct,
    coalesce(price_per_m2_status = '...', false) as is_suppressed,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'price_index_area_quarterly') }}
