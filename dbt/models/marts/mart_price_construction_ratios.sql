{#
    Price per m² of flats in blocks of flats by construction period relative to all flats in
    the area, one row per postal code and construction period. The finest geographic level
    with enough sales wins (see int_price_construction_ratios).
#}
with hierarchy as (
    select * from {{ ref('int_postal_area_hierarchy') }}
),

ratios as (
    select * from {{ ref('int_price_construction_ratios') }}
    where transaction_count >= {{ var('min_sales_for_construction_ratio', 30) }}
),

candidates as (
    select
        hierarchy.postal_code,
        ratios.*,
        case ratios.geography_level
            when 'postal_code' then 1
            when 'price_sub_area' then 2
            when 'municipality' then 3
            when 'region' then 4
            else 5
        end as priority
    from hierarchy
    inner join ratios
        on
            (hierarchy.postal_code = ratios.geography_code and ratios.geography_level = 'postal_code')
            or (
                hierarchy.price_sub_area_code = ratios.geography_code
                and ratios.geography_level = 'price_sub_area'
            )
            or (
                hierarchy.municipality_code = ratios.geography_code
                and ratios.geography_level = 'municipality'
            )
            or (hierarchy.region_code = ratios.geography_code and ratios.geography_level = 'region')
            or ratios.geography_level = 'country'
),

ranked as (
    select
        candidates.*,
        row_number() over (
            partition by candidates.postal_code, candidates.construction_period_code
            order by candidates.priority
        ) as rank_in_postal
    from candidates
)

select
    {{ natural_key(['postal_code', 'construction_period_code']) }} as price_construction_ratio_key,
    postal_code,
    construction_period_code,
    first_construction_year,
    last_construction_year,
    price_ratio,
    transaction_count,
    geography_level,
    geography_code,
    first_period_label,
    last_period_label
from ranked
where rank_in_postal = 1
