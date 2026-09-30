with days as (
    {{ dbt.date_spine('day', "cast('1988-01-01' as date)", "cast('2036-01-01' as date)") }}
)

select cast(date_day as date) as date_day
from days
