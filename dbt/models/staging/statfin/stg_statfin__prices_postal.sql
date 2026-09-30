with unioned as (
    select
        'quarter' as period_grain,
        {{ period_start_date('period', 'quarter') }} as period_start_date,
        period,
        postal_code,
        building_room_type,
        price_per_m2,
        price_per_m2_status,
        transaction_count,
        is_preliminary,
        source_table
    from {{ source('statfin', 'prices_postal_quarterly') }}

    union all

    select
        'year' as period_grain,
        {{ period_start_date('period', 'year') }} as period_start_date,
        period,
        postal_code,
        building_room_type,
        price_per_m2,
        price_per_m2_status,
        transaction_count,
        is_preliminary,
        source_table
    from {{ source('statfin', 'prices_postal_yearly') }}
)

select
    period_grain,
    period_start_date,
    period as period_label,
    postal_code,
    case building_room_type
        when '5' then 'terraced_house'
        else 'block_of_flats'
    end as building_type,
    case building_room_type
        when '1' then 'one_room'
        when '2' then 'two_room'
        when '3' then 'three_room_plus'
        when '5' then 'all'
    end as room_type,
    price_per_m2,
    cast(transaction_count as integer) as transaction_count,
    coalesce(price_per_m2_status = '...', false) as is_suppressed,
    coalesce(is_preliminary, false) as is_preliminary,
    source_table
from unioned
