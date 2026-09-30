with paavo as (
    select * from {{ ref('stg_paavo__postal_areas') }}
),

postal_areas as (
    select paavo.*
    from paavo
    where paavo.paavo_year = (select max(latest.paavo_year) from paavo as latest)
),

items as (
    select * from {{ ref('stg_classifications__items') }}
),

latest_classifications as (
    select
        classification_type,
        max(classification_year) as classification_year
    from items
    group by classification_type
),

latest_items as (
    select items.*
    from items
    inner join latest_classifications
        on
            items.classification_type = latest_classifications.classification_type
            and items.classification_year = latest_classifications.classification_year
),

municipalities as (
    select
        code as municipality_code,
        name_fi as municipality_name
    from latest_items
    where classification_type = 'municipality'
),

correspondences as (
    select * from {{ ref('stg_classifications__municipality_regions') }}
),

municipality_regions as (
    select
        correspondences.municipality_code,
        correspondences.region_code
    from correspondences
    where
        correspondences.classification_year
        = (select max(latest.classification_year) from correspondences as latest)
),

regions as (
    select
        code as region_code,
        name_fi as region_name
    from latest_items
    where classification_type = 'region'
),

price_sub_areas as (
    select distinct
        area_code,
        area_name
    from {{ ref('stg_statfin__price_index_area') }}
    where area_level = 'sub_area'
),

rent_sub_areas as (
    select distinct
        area_code,
        area_name
    from {{ ref('stg_statfin__rents_area') }}
    where area_level = 'sub_area' and rent_series = '2025_base'
),

postal_price_areas as (
    select
        postal.postal_code,
        price_sub_areas.area_code,
        price_sub_areas.area_name
    from {{ ref('stg_classifications__area_postal_codes') }} as postal
    inner join price_sub_areas on postal.area_code = price_sub_areas.area_code
    where postal.area_type = 'price_area'
),

postal_rent_areas as (
    select
        postal.postal_code,
        rent_sub_areas.area_code,
        rent_sub_areas.area_name
    from {{ ref('stg_classifications__area_postal_codes') }} as postal
    inner join rent_sub_areas on postal.area_code = rent_sub_areas.area_code
    where postal.area_type = 'rent_area'
)

select
    postal_areas.postal_code,
    postal_areas.name_fi as postal_area_name,
    postal_areas.name_sv as postal_area_name_sv,
    postal_areas.municipality_code,
    municipalities.municipality_name,
    municipality_regions.region_code,
    regions.region_name,
    postal_price_areas.area_code as price_sub_area_code,
    postal_price_areas.area_name as price_sub_area_name,
    postal_rent_areas.area_code as rent_sub_area_code,
    postal_rent_areas.area_name as rent_sub_area_name,
    postal_areas.municipality_code in {{ helsinki_metro_municipality_codes() }} as is_helsinki_metro,
    postal_areas.area_m2
from postal_areas
left join municipalities on postal_areas.municipality_code = municipalities.municipality_code
left join municipality_regions on postal_areas.municipality_code = municipality_regions.municipality_code
left join regions on municipality_regions.region_code = regions.region_code
left join postal_price_areas on postal_areas.postal_code = postal_price_areas.postal_code
left join postal_rent_areas on postal_areas.postal_code = postal_rent_areas.postal_code
