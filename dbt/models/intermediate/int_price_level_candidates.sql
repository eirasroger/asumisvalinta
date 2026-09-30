{#
    Latest published price per m² for each postal code and room type of flats in
    blocks of flats, at every geographic level. Lower priority wins.
#}
with hierarchy as (
    select * from {{ ref('int_postal_area_hierarchy') }}
),

room_types as (
    select room_type from {{ ref('dim_room_type') }}
    where room_type != 'all'
),

postal_prices as (
    select *
    from {{ ref('stg_statfin__prices_postal') }}
    where building_type = 'block_of_flats'
),

latest_postal_quarter as (
    select max(period_start_date) as period_start_date
    from postal_prices
    where period_grain = 'quarter'
),

latest_postal_year as (
    select max(period_start_date) as period_start_date
    from postal_prices
    where period_grain = 'year'
),

all_area_prices as (
    select * from {{ ref('stg_statfin__price_index_area') }}
),

area_prices as (
    select all_area_prices.*
    from all_area_prices
    where
        all_area_prices.building_type = 'block_of_flats'
        and all_area_prices.period_start_date
        = (select max(latest.period_start_date) from all_area_prices as latest)
),

all_municipality_prices as (
    select * from {{ ref('stg_statfin__prices_municipality') }}
),

municipality_prices as (
    select all_municipality_prices.*
    from all_municipality_prices
    where
        all_municipality_prices.building_type = 'block_of_flats'
        and all_municipality_prices.period_start_date
        = (select max(latest.period_start_date) from all_municipality_prices as latest)
),

postal_room as (
    select
        hierarchy.*,
        room_types.room_type
    from hierarchy
    cross join room_types
),

candidates as (
    select
        postal_room.postal_code,
        postal_room.room_type,
        1 as priority,
        'postal_code' as geography_level,
        postal_room.postal_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join postal_prices as prices
        on
            postal_room.postal_code = prices.postal_code
            and postal_room.room_type = prices.room_type
    where
        prices.period_grain = 'quarter'
        and prices.period_start_date
        = (select latest_postal_quarter.period_start_date from latest_postal_quarter)

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        2 as priority,
        'postal_code' as geography_level,
        postal_room.postal_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join postal_prices as prices
        on
            postal_room.postal_code = prices.postal_code
            and postal_room.room_type = prices.room_type
    where
        prices.period_grain = 'year'
        and prices.period_start_date
        = (select latest_postal_year.period_start_date from latest_postal_year)

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        3 as priority,
        'price_sub_area' as geography_level,
        prices.area_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join area_prices as prices
        on
            postal_room.price_sub_area_code = prices.area_code
            and postal_room.room_type = prices.room_type

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        4 as priority,
        'municipality' as geography_level,
        prices.area_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join area_prices as prices
        on
            postal_room.municipality_code = prices.area_code
            and postal_room.room_type = prices.room_type
    where prices.area_level = 'municipality'

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        5 as priority,
        'municipality_all_rooms' as geography_level,
        prices.municipality_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join municipality_prices as prices
        on postal_room.municipality_code = prices.municipality_code

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        6 as priority,
        'region' as geography_level,
        prices.area_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join area_prices as prices
        on
            {{ dbt.concat(["'MK'", "postal_room.region_code"]) }} = prices.area_code
            and postal_room.room_type = prices.room_type

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        7 as priority,
        'country' as geography_level,
        prices.area_code as geography_code,
        prices.period_grain,
        prices.period_label,
        prices.price_per_m2,
        prices.transaction_count,
        prices.is_preliminary
    from postal_room
    inner join area_prices as prices
        on
            prices.area_code = 'SSS'
            and postal_room.room_type = prices.room_type
)

select *
from candidates
where price_per_m2 is not null
