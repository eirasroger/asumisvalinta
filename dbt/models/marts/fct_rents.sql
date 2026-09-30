{#
    Average rents per m² per month. One row per geography, period, room type,
    funding type and rent series. The 2015-base and 2025-base series are kept side
    by side; compare levels only within one series.
#}
with postal as (
    select
        'postal_code' as area_scheme,
        postal_code as area_code,
        'postal_code' as geography_level,
        period_grain,
        period_start_date,
        period_label,
        room_type,
        funding_type,
        rent_series,
        rent_per_m2,
        observation_count,
        cast(null as {{ dbt.type_float() }}) as rent_per_m2_new_contracts,
        cast(null as integer) as observation_count_new_contracts,
        cast(null as {{ dbt.type_float() }}) as rent_index,
        cast(null as {{ dbt.type_float() }}) as rent_index_annual_change_pct,
        is_suppressed,
        source_table
    from {{ ref('stg_statfin__rents_postal') }}
),

areas as (
    select
        case rent_series
            when '2025_base' then 'rent_area'
            else 'rent_area_2015'
        end as area_scheme,
        area_code,
        area_level as geography_level,
        period_grain,
        period_start_date,
        period_label,
        room_type,
        funding_type,
        rent_series,
        rent_per_m2,
        observation_count,
        rent_per_m2_new_contracts,
        observation_count_new_contracts,
        rent_index,
        rent_index_annual_change_pct,
        is_suppressed,
        source_table
    from {{ ref('stg_statfin__rents_area') }}
),

unioned as (
    select * from postal
    union all
    select * from areas
)

select
    {{ natural_key([
        'area_scheme',
        'area_code',
        'period_start_date',
        'room_type',
        'funding_type',
        'rent_series'
    ]) }}
        as rent_key,
    {{ dbt.concat(['area_scheme', "':'", 'area_code']) }} as area_key,
    case when area_scheme = 'postal_code' then area_code end as postal_code,
    *
from unioned
