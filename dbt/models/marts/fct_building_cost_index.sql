select
    {{ natural_key(['month_start_date', 'base_year']) }} as building_cost_index_key,
    month_start_date,
    base_year,
    index_value,
    monthly_change_pct,
    annual_change_pct,
    is_preliminary,
    source_table
from {{ ref('stg_statfin__building_cost_index') }}
