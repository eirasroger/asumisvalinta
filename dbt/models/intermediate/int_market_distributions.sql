{#
    Typical ranges for each postal code and room type of flats in blocks of flats:
    quartiles of the price per m² and of the total monthly rent, from the latest quarter,
    taken from the price or rent sub-area, else from the municipality. Published for the
    large cities only; other postal codes get no range.
#}
with hierarchy as (
    select * from {{ ref('int_postal_area_hierarchy') }}
),

room_types as (
    select room_type from {{ ref('dim_room_type') }}
    where room_type != 'all'
),

prices as (
    select all_prices.*
    from {{ ref('stg_statfin__price_distribution') }} as all_prices
    where
        all_prices.building_type = 'block_of_flats'
        and all_prices.period_start_date = (
            select max(latest.period_start_date)
            from {{ ref('stg_statfin__price_distribution') }} as latest
        )
),

rents as (
    select all_rents.*
    from {{ ref('stg_statfin__rent_distribution') }} as all_rents
    where
        all_rents.period_start_date = (
            select max(latest.period_start_date)
            from {{ ref('stg_statfin__rent_distribution') }} as latest
        )
),

postal_room as (
    select
        hierarchy.postal_code,
        hierarchy.municipality_code,
        hierarchy.price_sub_area_code,
        hierarchy.rent_sub_area_code,
        room_types.room_type
    from hierarchy
    cross join room_types
)

select
    postal_room.postal_code,
    postal_room.room_type,
    coalesce(sub_price.area_code, municipal_price.area_code) as price_range_area_code,
    coalesce(sub_price.period_label, municipal_price.period_label) as price_range_period_label,
    coalesce(sub_price.price_per_m2_lower_quartile, municipal_price.price_per_m2_lower_quartile)
        as price_per_m2_lower_quartile,
    coalesce(sub_price.price_per_m2_median, municipal_price.price_per_m2_median)
        as price_per_m2_median,
    coalesce(sub_price.price_per_m2_upper_quartile, municipal_price.price_per_m2_upper_quartile)
        as price_per_m2_upper_quartile,
    coalesce(sub_rent.area_code, municipal_rent.area_code) as rent_range_area_code,
    coalesce(sub_rent.period_label, municipal_rent.period_label) as rent_range_period_label,
    coalesce(sub_rent.rent_lower_quartile, municipal_rent.rent_lower_quartile) as rent_lower_quartile,
    coalesce(sub_rent.rent_median, municipal_rent.rent_median) as rent_median,
    coalesce(sub_rent.rent_upper_quartile, municipal_rent.rent_upper_quartile) as rent_upper_quartile
from postal_room
left join prices as sub_price
    on
        postal_room.price_sub_area_code = sub_price.area_code
        and postal_room.room_type = sub_price.room_type
left join prices as municipal_price
    on
        postal_room.municipality_code = municipal_price.area_code
        and postal_room.room_type = municipal_price.room_type
left join rents as sub_rent
    on
        postal_room.rent_sub_area_code = sub_rent.area_code
        and postal_room.room_type = sub_rent.room_type
left join rents as municipal_rent
    on
        postal_room.municipality_code = municipal_rent.area_code
        and postal_room.room_type = municipal_rent.room_type
