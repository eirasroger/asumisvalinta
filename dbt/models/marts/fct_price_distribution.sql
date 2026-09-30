select
    {{ natural_key(['area_code', 'period_start_date', 'building_type', 'room_type']) }}
        as price_distribution_key,
    {{ dbt.concat(["'price_area:'", 'area_code']) }} as area_key,
    area_code,
    area_level as geography_level,
    period_start_date,
    period_label,
    building_type,
    room_type,
    price_per_m2_lower_quartile,
    price_per_m2_median,
    price_per_m2_upper_quartile,
    is_preliminary,
    source_table
from {{ ref('stg_statfin__price_distribution') }}
