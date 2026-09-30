{#
    Geographic level of a price or rent area code:
    country, metro_aggregate, region, municipality or sub_area.
#}
{% macro area_level(column) -%}
    case
        when {{ column }} in ('SSS', 'ksu') then 'country'
        when {{ column }} in ('pks', 'msu', 'kas', 'muu', 'keh') then 'metro_aggregate'
        when {{ column }} like 'MK%' or {{ column }} like 'A%' then 'region'
        when {{ column }} like '%-%' or {{ column }} like '%\_%' escape '\' then 'sub_area'
        else 'municipality'
    end
{%- endmacro %}
