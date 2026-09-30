select
    {{ natural_key(['area_code', 'period_start_date', 'room_type']) }} as rent_distribution_key,
    {{ dbt.concat(["'rent_area:'", 'area_code']) }} as area_key,
    area_code,
    area_level as geography_level,
    period_start_date,
    period_label,
    room_type,
    rent_lower_quartile,
    rent_median,
    rent_upper_quartile,
    observation_count,
    source_table
from {{ ref('stg_statfin__rent_distribution') }}
