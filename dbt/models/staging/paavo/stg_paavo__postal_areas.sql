select
    cast(year as integer) as paavo_year,
    postal_code,
    name_fi,
    name_sv,
    municipality_code,
    area_m2
from {{ source('paavo', 'postal_areas') }}
