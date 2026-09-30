{#
    Nominal growth of non-subsidised rents by area and room type. The 2015-base and
    2025-base rent indices are chained at the link quarter both cover, so growth
    across the series break uses changes within each series and never compares levels
    across series. Areas are matched by municipality, region and country codes.
#}
{% set link_quarter = "cast('2025-01-01' as date)" %}

with rents as (
    select
        case
            when rent_series = '2015_base' and area_code = 'ksu' then 'SSS'
            when rent_series = '2015_base' and area_code like 'A%'
                then {{ dbt.concat(["'MK'", "substr(area_code, 2, 2)"]) }}
            else area_code
        end as area_code,
        area_level,
        room_type,
        rent_series,
        period_start_date,
        rent_index
    from {{ ref('stg_statfin__rents_area') }}
    where
        funding_type = 'non_subsidised'
        and area_level in ('country', 'region', 'municipality')
        and rent_index is not null
),

new_series as (
    select * from rents
    where rent_series = '2025_base'
),

old_series as (
    select * from rents
    where rent_series = '2015_base'
),

latest as (
    select max(period_start_date) as period_start_date from new_series
),

endpoints as (
    select
        latest_q.area_code,
        latest_q.area_level,
        latest_q.room_type,
        latest_q.period_start_date as measured_to_date,
        latest_q.rent_index / nullif(new_link.rent_index, 0) as new_series_growth
    from new_series as latest_q
    inner join new_series as new_link
        on
            latest_q.area_code = new_link.area_code
            and latest_q.room_type = new_link.room_type
            and new_link.period_start_date = {{ link_quarter }}
    where latest_q.period_start_date = (select latest.period_start_date from latest)
),

horizons as (
    {% for years in [5, 10] %}
        select
            endpoints.area_code,
            endpoints.room_type,
            {{ years }} as years,
            endpoints.new_series_growth
            * old_link.rent_index / nullif(old_start.rent_index, 0) as growth_ratio
        from endpoints
        inner join old_series as old_link
            on
                endpoints.area_code = old_link.area_code
                and endpoints.room_type = old_link.room_type
                and old_link.period_start_date = {{ link_quarter }}
        inner join old_series as old_start
            on
                endpoints.area_code = old_start.area_code
                and endpoints.room_type = old_start.room_type
                and old_start.period_start_date
                = {{ dbt.dateadd('year', -years, 'endpoints.measured_to_date') }}
        {% if not loop.last %}union all{% endif %}
    {% endfor %}
)

select
    endpoints.area_code,
    endpoints.area_level,
    endpoints.room_type,
    endpoints.measured_to_date,
    power(five_years.growth_ratio, 1.0 / 5) - 1 as cagr_5y,
    power(ten_years.growth_ratio, 1.0 / 10) - 1 as cagr_10y
from endpoints
left join horizons as five_years
    on
        endpoints.area_code = five_years.area_code
        and endpoints.room_type = five_years.room_type
        and five_years.years = 5
left join horizons as ten_years
    on
        endpoints.area_code = ten_years.area_code
        and endpoints.room_type = ten_years.room_type
        and ten_years.years = 10
