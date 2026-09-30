{#
    Readable key built from the columns that identify a row, joined with ':'.
#}
{% macro natural_key(columns) -%}
    {%- set parts = [] -%}
    {%- for column in columns -%}
        {%- do parts.append(dbt.cast(column, dbt.type_string())) -%}
        {%- if not loop.last %}{% do parts.append("':'") %}{% endif -%}
    {%- endfor -%}
    {{ dbt.concat(parts) }}
{%- endmacro %}
