select
    'year' as period_grain,
    {{ period_start_date('period', 'year') }} as period_start_date,
    period as period_label,
    case company_type
        when 'SSS' then 'all'
        when '1' then 'terraced_house'
        when '2' then 'block_of_flats'
    end as building_type,
    construction_period as construction_period_code,
    construction_period_label as construction_period_name,
    case construction_period
        when '2' then 1960
        when '3' then 1970
        when '4' then 1980
        when '5' then 1990
        when '6' then 2000
        when '7' then 2010
    end as first_construction_year,
    case construction_period
        when '1' then 1959
        when '2' then 1969
        when '3' then 1979
        when '4' then 1989
        when '5' then 1999
        when '6' then 2009
    end as last_construction_year,
    account_item as account_item_code,
    account_item_label as account_item_name,
    value_cents_per_m2_month / 100.0 as value_eur_per_m2_month,
    coalesce(value_cents_per_m2_month_status = '...', false) as is_suppressed,
    source_table
from {{ source('statfin', 'housing_company_finances_by_age_yearly') }}
