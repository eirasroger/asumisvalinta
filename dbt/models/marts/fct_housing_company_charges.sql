select
    'housing_finance_area' as area_scheme,
    finance_area_code as area_code,
    period_grain,
    period_start_date,
    period_label,
    building_type,
    account_item_code,
    account_item_name,
    value_eur_per_m2_month,
    is_suppressed,
    source_table
from {{ ref('stg_statfin__housing_company_finances') }}
