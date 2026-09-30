{#
    Current market levels for flats in blocks of flats, one row per postal code and
    room type. Each value records the geography level and period it comes from:
    the finest level with published data wins (see int_price_level_candidates and
    int_rent_level_candidates). Growth rates come from the finest area with an index.
#}
with hierarchy as (
    select * from {{ ref('int_postal_area_hierarchy') }}
),

room_types as (
    select room_type from {{ ref('dim_room_type') }}
    where room_type != 'all'
),

ranked_prices as (
    select
        *,
        row_number() over (partition by postal_code, room_type order by priority) as rank_in_postal
    from {{ ref('int_price_level_candidates') }}
),

prices as (
    select * from ranked_prices
    where rank_in_postal = 1
),

ranked_rents as (
    select
        *,
        row_number() over (partition by postal_code, room_type order by priority) as rank_in_postal
    from {{ ref('int_rent_level_candidates') }}
),

rents as (
    select * from ranked_rents
    where rank_in_postal = 1
),

maintenance_charges as (
    select * from {{ ref('fct_housing_company_charges') }}
    where account_item_code = 'k3001'
),

latest_charges as (
    select
        area_code,
        period_label,
        value_eur_per_m2_month
    from maintenance_charges
    where
        building_type = 'block_of_flats'
        and period_start_date
        = (select max(latest.period_start_date) from maintenance_charges as latest)
),

price_growth_candidates as (
    select
        hierarchy.postal_code,
        growth.room_type,
        growth.area_code,
        growth.cagr_5y,
        growth.cagr_10y,
        growth.min_annual_change_10y,
        growth.max_annual_change_10y,
        case
            when growth.area_code = hierarchy.price_sub_area_code then 1
            when growth.area_code = hierarchy.municipality_code then 2
            when growth.area_code = {{ dbt.concat(["'MK'", "hierarchy.region_code"]) }} then 3
            else 4
        end as priority
    from hierarchy
    inner join {{ ref('int_price_index_growth') }} as growth
        on growth.area_code in (
            hierarchy.price_sub_area_code,
            hierarchy.municipality_code,
            {{ dbt.concat(["'MK'", "hierarchy.region_code"]) }},
            'SSS'
        )
    where growth.cagr_10y is not null
),

price_growth as (
    select *
    from (
        select
            *,
            row_number() over (partition by postal_code, room_type order by priority) as rank_in_postal
        from price_growth_candidates
    ) as ranked
    where rank_in_postal = 1
),

rent_growth_candidates as (
    select
        hierarchy.postal_code,
        growth.room_type,
        growth.area_code,
        growth.cagr_5y,
        growth.cagr_10y,
        case
            when growth.area_code = hierarchy.municipality_code then 1
            when growth.area_code = {{ dbt.concat(["'MK'", "hierarchy.region_code"]) }} then 2
            else 3
        end as priority
    from hierarchy
    inner join {{ ref('int_rent_index_growth') }} as growth
        on growth.area_code in (
            hierarchy.municipality_code,
            {{ dbt.concat(["'MK'", "hierarchy.region_code"]) }},
            'SSS'
        )
    where growth.cagr_5y is not null
),

rent_growth as (
    select *
    from (
        select
            *,
            row_number() over (partition by postal_code, room_type order by priority) as rank_in_postal
        from rent_growth_candidates
    ) as ranked
    where rank_in_postal = 1
)

select
    hierarchy.postal_code,
    room_types.room_type,
    hierarchy.municipality_code,
    hierarchy.region_code,
    hierarchy.is_helsinki_metro,

    prices.price_per_m2,
    prices.geography_level as price_geography_level,
    prices.geography_code as price_geography_code,
    prices.period_grain as price_period_grain,
    prices.period_label as price_period_label,
    prices.transaction_count as price_transaction_count,
    prices.is_preliminary as price_is_preliminary,

    rents.rent_per_m2,
    rents.rent_basis,
    rents.geography_level as rent_geography_level,
    rents.geography_code as rent_geography_code,
    rents.period_label as rent_period_label,
    rents.observation_count as rent_observation_count,

    charges.value_eur_per_m2_month as maintenance_charge_per_m2,
    case when hierarchy.is_helsinki_metro then 'pks' else 'msu' end as maintenance_charge_area_code,
    charges.period_label as maintenance_charge_period_label,

    price_growth.cagr_5y as price_cagr_5y,
    price_growth.cagr_10y as price_cagr_10y,
    price_growth.min_annual_change_10y as price_min_annual_change_10y,
    price_growth.max_annual_change_10y as price_max_annual_change_10y,
    price_growth.area_code as price_growth_area_code,

    rent_growth.cagr_5y as rent_cagr_5y,
    rent_growth.cagr_10y as rent_cagr_10y,
    rent_growth.area_code as rent_growth_area_code
from hierarchy
cross join room_types
left join prices
    on hierarchy.postal_code = prices.postal_code and room_types.room_type = prices.room_type
left join rents
    on hierarchy.postal_code = rents.postal_code and room_types.room_type = rents.room_type
left join latest_charges as charges
    on charges.area_code = case when hierarchy.is_helsinki_metro then 'pks' else 'msu' end
left join price_growth
    on
        hierarchy.postal_code = price_growth.postal_code
        and room_types.room_type = price_growth.room_type
left join rent_growth
    on
        hierarchy.postal_code = rent_growth.postal_code
        and room_types.room_type = rent_growth.room_type
