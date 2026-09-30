select
    classification,
    case
        when classification like 'kunta_%' then 'municipality'
        when classification like 'maakunta_%' then 'region'
        when classification like 'alue_43_%' then 'price_area'
        when classification like 'alue_44_%' then 'rent_area'
    end as classification_type,
    cast(substr(classification, length(classification) - 7, 4) as integer) as classification_year,
    code,
    name_fi,
    coalesce(name_en, name_fi) as name_en,
    parent_code,
    cast(level as integer) as classification_level,
    sort_order
from {{ source('classifications', 'classification_items') }}
