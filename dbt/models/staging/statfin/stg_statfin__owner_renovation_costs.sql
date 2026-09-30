select
    'year' as period_grain,
    {{ period_start_date('period', 'year') }} as period_start_date,
    period as period_label,
    structure_element as structure_element_code,
    structure_element_label as structure_element_name,
    case dwelling_type
        when 'SSS' then 'all'
        when '1' then 'detached_house'
        when '2' then 'terraced_house'
        when '3' then 'block_of_flats'
    end as building_type,
    renovation_costs_eur_million,
    renovation_costs_eur_per_m2 as renovation_costs_eur_per_m2_year,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'owner_renovation_costs_yearly') }}
