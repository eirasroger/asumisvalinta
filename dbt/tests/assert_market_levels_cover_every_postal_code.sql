-- Every postal code needs a market level row for every room type.
select
    postal_areas.postal_code,
    room_types.room_type
from {{ ref('dim_postal_area') }} as postal_areas
cross join {{ ref('dim_room_type') }} as room_types
left join {{ ref('mart_market_levels') }} as levels
    on
        postal_areas.postal_code = levels.postal_code
        and room_types.room_type = levels.room_type
where
    room_types.room_type != 'all'
    and levels.postal_code is null
