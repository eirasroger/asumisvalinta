{#
    Prices per m² of old dwellings in housing companies. One row per geography,
    period, building type and room type. Postal code rows come from the postal code
    tables; area rows (price sub-areas, municipalities, regions, country) come from
    the area table; municipality_2015 rows come from the yearly municipality table.
#}
with postal as (
    select
        'postal_code' as area_scheme,
        postal_code as area_code,
        'postal_code' as geography_level,
        period_grain,
        period_start_date,
        period_label,
        building_type,
        room_type,
        price_per_m2,
        transaction_count,
        cast(null as {{ dbt.type_float() }}) as price_index_2025,
        cast(null as {{ dbt.type_float() }}) as price_index_annual_change_pct,
        is_suppressed,
        is_preliminary,
        source_table
    from {{ ref('stg_statfin__prices_postal') }}
),

areas as (
    select
        'price_area' as area_scheme,
        area_code,
        area_level as geography_level,
        period_grain,
        period_start_date,
        period_label,
        building_type,
        room_type,
        price_per_m2,
        transaction_count,
        price_index_2025,
        price_index_annual_change_pct,
        is_suppressed,
        is_preliminary,
        source_table
    from {{ ref('stg_statfin__price_index_area') }}
),

municipalities as (
    select
        'municipality_2015' as area_scheme,
        municipality_code as area_code,
        'municipality' as geography_level,
        period_grain,
        period_start_date,
        period_label,
        building_type,
        room_type,
        price_per_m2,
        transaction_count,
        cast(null as {{ dbt.type_float() }}) as price_index_2025,
        cast(null as {{ dbt.type_float() }}) as price_index_annual_change_pct,
        is_suppressed,
        is_preliminary,
        source_table
    from {{ ref('stg_statfin__prices_municipality') }}
),

unioned as (
    select * from postal
    union all
    select * from areas
    union all
    select * from municipalities
)

select
    {{ natural_key([
        'area_scheme',
        'area_code',
        'period_grain',
        'period_start_date',
        'building_type',
        'room_type'
    ]) }}
        as dwelling_price_key,
    {{ dbt.concat(['area_scheme', "':'", 'area_code']) }} as area_key,
    case when area_scheme = 'postal_code' then area_code end as postal_code,
    *
from unioned
