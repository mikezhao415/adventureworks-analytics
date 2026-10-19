select
    cast("SpecialOfferID" as integer) as special_offer_id,
    cast("ProductID" as integer) as product_id,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'special_offer_product') }}
