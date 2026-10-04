{#
    Streets with building number ranges and the postal code area each range belongs to, for
    address search. Only postal codes with a postal code area are kept.
#}
select distinct
    streets.street_name_fi,
    streets.street_name_sv,
    streets.municipality_code,
    postal.municipality_name,
    streets.postal_code,
    postal.postal_area_name,
    postal.is_helsinki_metro,
    streets.building_numbers,
    streets.lowest_building_number,
    streets.highest_building_number,
    streets.extracted_on,
    streets.downloaded_on
from {{ ref('stg_posti__street_addresses') }} as streets
inner join {{ ref('dim_postal_area') }} as postal
    on streets.postal_code = postal.postal_code
