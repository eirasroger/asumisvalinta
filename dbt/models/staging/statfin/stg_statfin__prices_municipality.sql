select
    'year' as period_grain,
    {{ period_start_date('period', 'year') }} as period_start_date,
    period as period_label,
    municipality_code,
    municipality_code_label as municipality_name,
    case building_type
        when '0' then 'all'
        when '1' then 'terraced_house'
        when '3' then 'block_of_flats'
    end as building_type,
    'all' as room_type,
    price_per_m2,
    cast(coalesce(transaction_count, transaction_count_until_2019) as integer) as transaction_count,
    coalesce(price_per_m2_status = '...', false) as is_suppressed,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from {{ source('statfin', 'prices_municipality_yearly') }}
