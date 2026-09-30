select
    'year' as period_grain,
    {{ period_start_date('period', 'year') }} as period_start_date,
    period as period_label,
    index_value as consumer_price_index_2015,
    source_table
from {{ source('statfin', 'consumer_price_index_yearly') }}
where index_series = '0_2015'
    and index_value is not null
