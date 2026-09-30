select
    'quarter' as period_grain,
    {{ period_start_date('period', 'quarter') }} as period_start_date,
    period as period_label,
    postal_code,
    {{ rent_room_type('room_type') }} as room_type,
    'non_subsidised' as funding_type,
    '2015_base' as rent_series,
    rent_per_m2,
    cast(observation_count as integer) as observation_count,
    coalesce(rent_per_m2_status = '...', false) as is_suppressed,
    source_table
from {{ source('statfin', 'rents_postal_quarterly_2015') }}
