select
    {{ period_start_date('period', 'quarter') }} as period_start_date,
    period as period_label,
    price_area as area_code,
    price_area_label as area_name,
    {{ area_level('price_area') }} as area_level,
    {{ price_area_building_type('building_type') }} as building_type,
    {{ price_area_room_type('room_type') }} as room_type,
    price_per_m2_lower_quartile,
    price_per_m2_median,
    price_per_m2_upper_quartile,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'price_distribution_area_quarterly') }}
where price_per_m2_median is not null
