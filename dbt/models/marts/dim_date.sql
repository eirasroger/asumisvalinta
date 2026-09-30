with months as (
    {{ dbt.date_spine('month', "cast('1988-01-01' as date)", "cast('2036-01-01' as date)") }}
)

select
    cast(date_month as date) as month_start_date,
    cast({{ dbt.date_trunc('quarter', 'date_month') }} as date) as quarter_start_date,
    cast({{ dbt.date_trunc('year', 'date_month') }} as date) as year_start_date,
    cast(extract(year from date_month) as integer) as calendar_year,
    cast(extract(quarter from date_month) as integer) as calendar_quarter,
    cast(extract(month from date_month) as integer) as calendar_month,
    {{ dbt.concat([
        dbt.cast('extract(year from date_month)', dbt.type_string()),
        "'Q'",
        dbt.cast('extract(quarter from date_month)', dbt.type_string())
    ]) }} as quarter_label
from months
