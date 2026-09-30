select
    cast(substr(correspondence_table, 9, 4) as integer) as classification_year,
    source_code as municipality_code,
    target_code as region_code
from {{ source('classifications', 'correspondence_maps') }}
where correspondence_table like 'kunta_%#maakunta_%'
