select
    {{ natural_key(['month_start_date']) }} as interest_rate_key,
    month_start_date,
    max(case when fixation_period = 'all' then rate_pct end) as new_mortgage_rate_pct,
    max(case when fixation_period = 'variable_up_to_1y' then rate_pct end)
        as new_mortgage_rate_variable_pct,
    max(case when fixation_period = 'fixed_1_to_5y' then rate_pct end)
        as new_mortgage_rate_fixed_1_to_5y_pct,
    max(case when fixation_period = 'fixed_5_to_10y' then rate_pct end)
        as new_mortgage_rate_fixed_5_to_10y_pct,
    max(case when fixation_period = 'fixed_over_10y' then rate_pct end)
        as new_mortgage_rate_fixed_over_10y_pct
from {{ ref('stg_ecb__mortgage_rates') }}
group by month_start_date
