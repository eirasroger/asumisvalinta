with rents_2025_base as (
    select
        {{ period_start_date('period', 'quarter') }} as period_start_date,
        period,
        rent_area,
        rent_area_label,
        room_type,
        case funding_type
            when 'SSS' then 'all'
            when '1' then 'non_subsidised'
            when '2' then 'subsidised'
        end as funding_type,
        '2025_base' as rent_series,
        rent_index_2025 as rent_index,
        rent_index_quarterly_change_pct,
        rent_index_annual_change_pct,
        rent_per_m2,
        observation_count,
        rent_per_m2_new_contracts,
        observation_count_new_contracts,
        rent_per_m2_status,
        source_table
    from {{ source('statfin', 'rents_area_quarterly') }}
),

rents_2015_base as (
    select
        {{ period_start_date('period', 'quarter') }} as period_start_date,
        period,
        rent_area,
        rent_area_label,
        room_type,
        case funding_type
            when '2' then 'all'
            when '1' then 'non_subsidised'
            when '0' then 'subsidised'
        end as funding_type,
        '2015_base' as rent_series,
        rent_index_2015 as rent_index,
        rent_index_quarterly_change_pct,
        rent_index_annual_change_pct,
        rent_per_m2,
        observation_count,
        rent_per_m2_new_contracts,
        observation_count_new_contracts,
        rent_per_m2_status,
        source_table
    from {{ source('statfin', 'rents_area_quarterly_2015') }}
),

unioned as (
    select * from rents_2025_base
    union all
    select * from rents_2015_base
)

select
    'quarter' as period_grain,
    period_start_date,
    period as period_label,
    rent_area as area_code,
    rent_area_label as area_name,
    {{ area_level('rent_area') }} as area_level,
    {{ rent_room_type('room_type') }} as room_type,
    funding_type,
    rent_series,
    rent_index,
    rent_index_quarterly_change_pct,
    rent_index_annual_change_pct,
    rent_per_m2,
    cast(observation_count as integer) as observation_count,
    rent_per_m2_new_contracts,
    cast(observation_count_new_contracts as integer) as observation_count_new_contracts,
    coalesce(rent_per_m2_status = '...', false) as is_suppressed,
    source_table
from unioned
