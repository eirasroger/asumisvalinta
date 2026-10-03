{#
    Price per m² of flats in blocks of flats by construction period, relative to all flats in
    the same postal code and year, so the ratio compares buildings of different ages in the
    same place. Ratios are averaged over the last five years of the table with the sales of
    the period as weights, at every geographic level.
#}
with prices as (
    select * from {{ ref('stg_statfin__prices_postal_by_construction') }}
),

recent as (
    select prices.*
    from prices
    where
        extract(year from prices.period_start_date)
        > (select max(extract(year from latest.period_start_date)) from prices as latest) - 5
),

totals as (
    select
        postal_code,
        period_start_date,
        price_per_m2
    from recent
    where construction_period_code = '0' and price_per_m2 is not null
),

cells as (
    select
        recent.postal_code,
        recent.period_label,
        recent.construction_period_code,
        recent.first_construction_year,
        recent.last_construction_year,
        recent.price_per_m2 / totals.price_per_m2 as price_ratio,
        recent.transaction_count
    from recent
    inner join totals
        on
            recent.postal_code = totals.postal_code
            and recent.period_start_date = totals.period_start_date
    where
        recent.construction_period_code != '0'
        and recent.price_per_m2 is not null
        and recent.transaction_count > 0
),

located as (
    select
        cells.*,
        hierarchy.price_sub_area_code,
        hierarchy.municipality_code,
        hierarchy.region_code
    from cells
    left join {{ ref('int_postal_area_hierarchy') }} as hierarchy
        on cells.postal_code = hierarchy.postal_code
),

levels as (
    select
        'postal_code' as geography_level,
        located.postal_code as geography_code,
        located.*
    from located

    union all

    select
        'price_sub_area' as geography_level,
        located.price_sub_area_code as geography_code,
        located.*
    from located
    where located.price_sub_area_code is not null

    union all

    select
        'municipality' as geography_level,
        located.municipality_code as geography_code,
        located.*
    from located
    where located.municipality_code is not null

    union all

    select
        'region' as geography_level,
        located.region_code as geography_code,
        located.*
    from located
    where located.region_code is not null

    union all

    select
        'country' as geography_level,
        'SSS' as geography_code,
        located.*
    from located
)

select
    geography_level,
    geography_code,
    construction_period_code,
    first_construction_year,
    last_construction_year,
    sum(price_ratio * transaction_count) / sum(transaction_count) as price_ratio,
    sum(transaction_count) as transaction_count,
    min(period_label) as first_period_label,
    max(period_label) as last_period_label
from levels
group by
    geography_level,
    geography_code,
    construction_period_code,
    first_construction_year,
    last_construction_year
