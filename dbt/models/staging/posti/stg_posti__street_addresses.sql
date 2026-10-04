select
    postal_code,
    street_name_fi,
    street_name_sv,
    case building_data_type
        when '1' then 'odd'
        when '2' then 'even'
        else 'all'
    end as building_numbers,
    cast(lowest_number as integer) as lowest_building_number,
    cast(coalesce(highest_number, lowest_number) as integer) as highest_building_number,
    municipality_code,
    municipality_name_fi as municipality_name,
    municipality_name_sv,
    extracted_on,
    cast(downloaded_at as date) as downloaded_on,
    source_file
from {{ source('posti', 'street_addresses') }}
where street_name_fi is not null
