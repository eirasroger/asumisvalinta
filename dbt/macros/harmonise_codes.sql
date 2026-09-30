{% macro price_area_room_type(column) -%}
    case {{ column }}
        when '00' then 'all'
        when '01' then 'one_room'
        when '02' then 'two_room'
        when '03' then 'three_room_plus'
    end
{%- endmacro %}

{% macro price_area_building_type(column) -%}
    case {{ column }}
        when '0' then 'all'
        when '1' then 'terraced_house'
        when '3' then 'block_of_flats'
    end
{%- endmacro %}

{% macro rent_room_type(column) -%}
    case {{ column }}
        when 'SSS' then 'all'
        when '00' then 'all'
        when '1' then 'one_room'
        when '01' then 'one_room'
        when '2' then 'two_room'
        when '02' then 'two_room'
        when '3' then 'three_room_plus'
        when '03' then 'three_room_plus'
    end
{%- endmacro %}
