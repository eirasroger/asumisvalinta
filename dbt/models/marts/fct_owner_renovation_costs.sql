select
    {{ natural_key(['period_start_date', 'building_type', 'structure_element_code']) }}
        as owner_renovation_cost_key,
    period_grain,
    period_start_date,
    period_label,
    building_type,
    structure_element_code,
    structure_element_name,
    renovation_costs_eur_million,
    renovation_costs_eur_per_m2_year,
    is_preliminary,
    source_table
from {{ ref('stg_statfin__owner_renovation_costs') }}
