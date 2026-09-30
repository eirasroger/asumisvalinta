with current_table as (
    select
        period,
        case company_type
            when 'SSS' then 'all'
            when '1' then 'terraced_house'
            when '2' then 'block_of_flats'
        end as building_type,
        account_item,
        account_item_label,
        finance_area,
        finance_area_label,
        value_cents_per_m2_month,
        value_cents_per_m2_month_status,
        source_table
    from {{ source('statfin', 'housing_company_finances_yearly') }}
),

discontinued_table as (
    select
        period,
        {{ price_area_building_type('building_type') }} as building_type,
        account_item,
        account_item_label,
        finance_area,
        finance_area_label,
        value_cents_per_m2_month,
        value_cents_per_m2_month_status,
        source_table
    from {{ source('statfin', 'housing_company_finances_yearly_2009') }}
    where period not in (select distinct current_years.period from current_table as current_years)
),

unioned as (
    select * from current_table
    union all
    select * from discontinued_table
)

select
    'year' as period_grain,
    {{ period_start_date('period', 'year') }} as period_start_date,
    period as period_label,
    finance_area as finance_area_code,
    finance_area_label as finance_area_name,
    building_type,
    account_item as account_item_code,
    account_item_label as account_item_name,
    value_cents_per_m2_month,
    value_cents_per_m2_month / 100.0 as value_eur_per_m2_month,
    coalesce(value_cents_per_m2_month_status = '...', false) as is_suppressed,
    source_table
from unioned
