select
    'year' as period_grain,
    {{ period_start_date('period', 'year') }} as period_start_date,
    period as period_label,
    postal_code,
    construction_period as construction_period_code,
    construction_period_label as construction_period_name,
    case construction_period
        when '2' then 1950
        when '3' then 1960
        when '4' then 1970
        when '5' then 1980
        when '6' then 1990
        when '7' then 2000
        when '8' then 2010
    end as first_construction_year,
    case construction_period
        when '1' then 1949
        when '2' then 1959
        when '3' then 1969
        when '4' then 1979
        when '5' then 1989
        when '6' then 1999
        when '7' then 2009
    end as last_construction_year,
    price_per_m2,
    cast(transaction_count as integer) as transaction_count,
    coalesce(price_per_m2_status in ('..', '...'), false) as is_suppressed,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'prices_postal_by_construction_yearly_2010') }}
where building_room_type = '4'
