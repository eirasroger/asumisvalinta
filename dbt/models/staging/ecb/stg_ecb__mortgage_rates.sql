select
    {{ period_start_date('time_period', 'iso_month') }} as month_start_date,
    series_key,
    case fixation_period
        when 'A' then 'all'
        when 'F' then 'variable_up_to_1y'
        when 'I' then 'fixed_1_to_5y'
        when 'O' then 'fixed_5_to_10y'
        when 'P' then 'fixed_over_10y'
    end as fixation_period,
    rate_pct,
    obs_status
from {{ source('ecb', 'mir_interest_rates') }}
where rate_pct is not null
    and balance_sheet_item = 'A2C'
