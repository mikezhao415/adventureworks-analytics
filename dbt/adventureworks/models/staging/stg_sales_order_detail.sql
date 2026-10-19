select
    cast("SalesOrderID" as integer) as sales_order_id,
    cast("SalesOrderDetailID" as integer) as sales_order_detail_id,
    cast("OrderQty" as integer) as order_qty,
    cast("ProductID" as integer) as product_id,
    cast("SpecialOfferID" as integer) as special_offer_id,
    cast("UnitPrice" as decimal(19,4)) as unit_price,
    cast("UnitPriceDiscount" as decimal(19,4)) as unit_price_discount,
    cast("LineTotal" as decimal(38,6)) as line_total,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'sales_order_detail') }}
