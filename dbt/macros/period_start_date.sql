{#
    First day of a period given as text.
    grain: 'year' ('2025'), 'quarter' ('2025Q4'), 'month' ('2026M08') or 'iso_month' ('2026-07').
#}
{% macro period_start_date(period, grain) -%}
    {%- if grain == 'year' -%}
        cast({{ dbt.concat([period, "'-01-01'"]) }} as date)
    {%- elif grain == 'quarter' -%}
        cast({{ dbt.concat([
            "substr(" ~ period ~ ", 1, 4)",
            "'-'",
            "lpad(cast((cast(substr(" ~ period ~ ", 6, 1) as integer) - 1) * 3 + 1 as " ~ dbt.type_string() ~ "), 2, '0')",
            "'-01'"
        ]) }} as date)
    {%- elif grain == 'month' -%}
        cast({{ dbt.concat(["substr(" ~ period ~ ", 1, 4)", "'-'", "substr(" ~ period ~ ", 6, 2)", "'-01'"]) }} as date)
    {%- elif grain == 'iso_month' -%}
        cast({{ dbt.concat([period, "'-01'"]) }} as date)
    {%- else -%}
        {{ exceptions.raise_compiler_error("Unknown period grain: " ~ grain) }}
    {%- endif -%}
{%- endmacro %}
