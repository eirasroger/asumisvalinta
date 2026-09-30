with deposits as (
    select
        month_start_date,
        rate_pct
    from {{ ref('stg_ecb__deposit_rates') }}
),

loans as (
    select
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
)

select
    {{ natural_key(['loans.month_start_date']) }} as interest_rate_key,
    loans.month_start_date,
    loans.new_mortgage_rate_pct,
    loans.new_mortgage_rate_variable_pct,
    loans.new_mortgage_rate_fixed_1_to_5y_pct,
    loans.new_mortgage_rate_fixed_5_to_10y_pct,
    loans.new_mortgage_rate_fixed_over_10y_pct,
    deposits.rate_pct as new_deposit_rate_up_to_1y_pct
from loans
left join deposits on loans.month_start_date = deposits.month_start_date
