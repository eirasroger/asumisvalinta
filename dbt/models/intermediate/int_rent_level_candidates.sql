{#
    Latest published non-subsidised rent per m² for each postal code and room type,
    at every geographic level. New-contract rents are preferred where published.
    Lower priority wins.
#}
with hierarchy as (
    select * from {{ ref('int_postal_area_hierarchy') }}
),

room_types as (
    select room_type from {{ ref('dim_room_type') }}
    where room_type != 'all'
),

rents_2025_base as (
    select * from {{ ref('stg_statfin__rents_area') }}
    where rent_series = '2025_base'
),

latest_rents as (
    select
        area_code,
        area_level,
        room_type,
        period_grain,
        period_label,
        coalesce(rent_per_m2_new_contracts, rent_per_m2) as rent_per_m2,
        case
            when rent_per_m2_new_contracts is not null then 'new_contracts'
            else 'all_contracts'
        end as rent_basis,
        case
            when rent_per_m2_new_contracts is not null then observation_count_new_contracts
            else observation_count
        end as observation_count
    from rents_2025_base
    where
        funding_type = 'non_subsidised'
        and period_start_date
        = (select max(latest.period_start_date) from rents_2025_base as latest)
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
        'rent_sub_area' as geography_level,
        rents.area_code as geography_code,
        rents.period_grain,
        rents.period_label,
        rents.rent_per_m2,
        rents.rent_basis,
        rents.observation_count
    from postal_room
    inner join latest_rents as rents
        on
            postal_room.rent_sub_area_code = rents.area_code
            and postal_room.room_type = rents.room_type

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        2 as priority,
        'municipality' as geography_level,
        rents.area_code as geography_code,
        rents.period_grain,
        rents.period_label,
        rents.rent_per_m2,
        rents.rent_basis,
        rents.observation_count
    from postal_room
    inner join latest_rents as rents
        on
            postal_room.municipality_code = rents.area_code
            and postal_room.room_type = rents.room_type
    where rents.area_level = 'municipality'

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        3 as priority,
        'region' as geography_level,
        rents.area_code as geography_code,
        rents.period_grain,
        rents.period_label,
        rents.rent_per_m2,
        rents.rent_basis,
        rents.observation_count
    from postal_room
    inner join latest_rents as rents
        on
            {{ dbt.concat(["'MK'", "postal_room.region_code"]) }} = rents.area_code
            and postal_room.room_type = rents.room_type

    union all

    select
        postal_room.postal_code,
        postal_room.room_type,
        4 as priority,
        'country' as geography_level,
        rents.area_code as geography_code,
        rents.period_grain,
        rents.period_label,
        rents.rent_per_m2,
        rents.rent_basis,
        rents.observation_count
    from postal_room
    inner join latest_rents as rents
        on
            rents.area_code = 'SSS'
            and postal_room.room_type = rents.room_type
)

select *
from candidates
where rent_per_m2 is not null
