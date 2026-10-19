select
    cast("SpecialOfferID" as integer) as special_offer_id,
    cast("Description" as varchar) as description,
    cast("DiscountPct" as decimal(19,4)) as discount_pct,
    cast("Type" as varchar) as type,
    cast("Category" as varchar) as category,
    cast("StartDate" as timestamp) as start_date,
    cast("EndDate" as timestamp) as end_date,
    cast("MinQty" as integer) as min_qty,
    cast("MaxQty" as integer) as max_qty,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'special_offer') }}
