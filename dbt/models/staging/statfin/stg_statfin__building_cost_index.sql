select
    {{ period_start_date('period', 'month') }} as month_start_date,
    period as period_label,
    cast(substr(base_year, 1, 4) as integer) as base_year,
    index_value,
    monthly_change_pct,
    annual_change_pct,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'building_cost_index_monthly') }}
where index_value is not null
