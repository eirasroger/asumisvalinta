select
    postal_code,
    postal_area_name,
    postal_area_name_sv,
    municipality_code,
    municipality_name,
    region_code,
    region_name,
    price_sub_area_code,
    price_sub_area_name,
    rent_sub_area_code,
    rent_sub_area_name,
    is_helsinki_metro,
    area_m2
from {{ ref('int_postal_area_hierarchy') }}
