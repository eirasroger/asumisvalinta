select
    {{ period_start_date('period', 'quarter') }} as period_start_date,
    period as period_label,
    rent_area as area_code,
    rent_area_label as area_name,
    {{ area_level('rent_area') }} as area_level,
    {{ rent_room_type('room_type') }} as room_type,
    rent_lower_quartile,
    rent_median,
    rent_upper_quartile,
    cast(observation_count as integer) as observation_count,
    source_table
from {{ source('statfin', 'rent_distribution_area_quarterly') }}
where rent_median is not null
