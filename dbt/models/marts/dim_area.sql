{#
    Areas used by the area-level facts. An area is identified by its scheme and code,
    because codes such as '091' appear in several schemes.
#}
with price_areas as (
    select distinct
        'price_area' as area_scheme,
        area_code,
        area_name,
        area_level
    from {{ ref('stg_statfin__price_index_area_chained') }}
),

rent_areas as (
    select distinct
        case rent_series
            when '2025_base' then 'rent_area'
            else 'rent_area_2015'
        end as area_scheme,
        area_code,
        area_name,
        area_level
    from {{ ref('stg_statfin__rents_area') }}
),

municipalities as (
    select distinct
        'municipality_2015' as area_scheme,
        municipality_code as area_code,
        municipality_name as area_name,
        'municipality' as area_level
    from {{ ref('stg_statfin__prices_municipality') }}
),

finance_areas as (
    select distinct
        'housing_finance_area' as area_scheme,
        finance_area_code as area_code,
        finance_area_name as area_name,
        case finance_area_code
            when 'ksu' then 'country'
            when 'pks' then 'metro_aggregate'
            when 'msu' then 'metro_aggregate'
            else 'major_region'
        end as area_level
    from {{ ref('stg_statfin__housing_company_finances') }}
),

unioned as (
    select * from price_areas
    union all
    select * from rent_areas
    union all
    select * from municipalities
    union all
    select * from finance_areas
)

select
    {{ dbt.concat(['area_scheme', "':'", 'area_code']) }} as area_key,
    *
from unioned
