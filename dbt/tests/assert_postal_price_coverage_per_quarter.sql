-- Every quarter should publish prices for a substantial number of postal codes.
-- A sharp drop signals a broken load or a change in the source table.
select
    period_label,
    count(*) as postal_codes_with_price
from {{ ref('fct_dwelling_prices') }}
where
    area_scheme = 'postal_code'
    and period_grain = 'quarter'
    and price_per_m2 is not null
group by period_label
having count(*) < {{ var("min_postal_codes_per_quarter", 300) }}
