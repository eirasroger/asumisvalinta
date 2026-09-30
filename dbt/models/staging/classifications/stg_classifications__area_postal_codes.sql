select
    case
        when classification like 'alue_43_%' then 'price_area'
        when classification like 'alue_44_%' then 'rent_area'
    end as area_type,
    classification,
    area_code,
    postal_code
from {{ source('classifications', 'area_postal_codes') }}
