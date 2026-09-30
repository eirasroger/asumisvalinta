select
    {{ period_start_date('time_period', 'iso_month') }} as month_start_date,
    series_key,
    rate_pct,
    obs_status
from {{ source('ecb', 'mir_interest_rates') }}
where rate_pct is not null
    and balance_sheet_item = 'L22'
    and fixation_period = 'F'
