select
    {{ natural_key(['period_start_date', 'building_type', 'construction_period_code', 'account_item_code']) }}
        as housing_company_charge_by_age_key,
    period_grain,
    period_start_date,
    period_label,
    building_type,
    construction_period_code,
    construction_period_name,
    first_construction_year,
    last_construction_year,
    account_item_code,
    account_item_name,
    value_eur_per_m2_month,
    is_suppressed,
    source_table
from {{ ref('stg_statfin__housing_company_finances_by_age') }}
