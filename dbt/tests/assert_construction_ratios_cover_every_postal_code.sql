-- Every postal code has a price ratio for each of the eight construction periods.
select hierarchy.postal_code
from {{ ref('int_postal_area_hierarchy') }} as hierarchy
left join {{ ref('mart_price_construction_ratios') }} as ratios
    on hierarchy.postal_code = ratios.postal_code
group by hierarchy.postal_code
having count(ratios.construction_period_code) != 8
