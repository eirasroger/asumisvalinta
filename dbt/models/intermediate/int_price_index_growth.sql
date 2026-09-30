{#
    Nominal price growth of old flats by area and room type from the chained price index:
    compound annual growth over 5 and 10 years and the range of year-over-year changes
    over the last 10 years. Growth is measured from the latest final (non-preliminary) quarter.
#}
{% set bases = ['1983', '2000', '2005', '2010', '2015', '2020'] %}

with indices as (
    select *
    from {{ ref('stg_statfin__price_index_area_chained') }}
    where building_type = 'block_of_flats'
),

latest_period as (
    select max(period_start_date) as period_start_date
    from indices
    where not is_preliminary
),

latest_final as (
    select
        period_start_date,
        {{ dbt.dateadd('year', -10, 'period_start_date') }} as window_start_date
    from latest_period
),

pairs as (
    select
        current_q.area_code,
        current_q.area_level,
        current_q.room_type,
        current_q.period_start_date,
        coalesce(
            {% for base in bases %}
                current_q.price_index_{{ base }} / nullif(previous_q.price_index_{{ base }}, 0)
                {%- if not loop.last %},{% endif %}
            {% endfor %}
        ) as ratio_to_previous_year
    from indices as current_q
    inner join indices as previous_q
        on
            current_q.area_code = previous_q.area_code
            and current_q.room_type = previous_q.room_type
            and previous_q.period_start_date = {{ dbt.dateadd('year', -1, 'current_q.period_start_date') }}
),

horizons as (
    {% for years in [5, 10] %}
        select
            current_q.area_code,
            current_q.room_type,
            {{ years }} as years,
            coalesce(
                {% for base in bases %}
                    current_q.price_index_{{ base }} / nullif(start_q.price_index_{{ base }}, 0)
                    {%- if not loop.last %},{% endif %}
                {% endfor %}
            ) as growth_ratio
        from indices as current_q
        inner join indices as start_q
            on
                current_q.area_code = start_q.area_code
                and current_q.room_type = start_q.room_type
                and start_q.period_start_date
                = {{ dbt.dateadd('year', -years, 'current_q.period_start_date') }}
        where current_q.period_start_date = (select latest_final.period_start_date from latest_final)
        {% if not loop.last %}union all{% endif %}
    {% endfor %}
),

annual_range as (
    select
        pairs.area_code,
        pairs.area_level,
        pairs.room_type,
        min(pairs.ratio_to_previous_year) - 1 as min_annual_change_10y,
        max(pairs.ratio_to_previous_year) - 1 as max_annual_change_10y,
        count(*) as quarters_in_range
    from pairs
    inner join latest_final
        on
            pairs.period_start_date > latest_final.window_start_date
            and pairs.period_start_date <= latest_final.period_start_date
    group by pairs.area_code, pairs.area_level, pairs.room_type
)

select
    annual_range.area_code,
    annual_range.area_level,
    annual_range.room_type,
    (select latest_final.period_start_date from latest_final) as measured_to_date,
    power(five_years.growth_ratio, 1.0 / 5) - 1 as cagr_5y,
    power(ten_years.growth_ratio, 1.0 / 10) - 1 as cagr_10y,
    annual_range.min_annual_change_10y,
    annual_range.max_annual_change_10y,
    annual_range.quarters_in_range
from annual_range
left join horizons as five_years
    on
        annual_range.area_code = five_years.area_code
        and annual_range.room_type = five_years.room_type
        and five_years.years = 5
left join horizons as ten_years
    on
        annual_range.area_code = ten_years.area_code
        and annual_range.room_type = ten_years.room_type
        and ten_years.years = 10
