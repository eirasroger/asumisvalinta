select
    {{ natural_key(['period_start_date']) }} as consumer_price_index_key,
    period_grain,
    period_start_date,
    period_label,
    consumer_price_index_2015,
    source_table
from {{ ref('stg_statfin__consumer_price_index') }}
