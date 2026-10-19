select
    cast("ProductID" as integer) as product_id,
    cast("Name" as varchar) as name,
    cast("ProductNumber" as varchar) as product_number,
    cast("Color" as varchar) as color,
    cast("ProductSubcategoryID" as integer) as product_subcategory_id,
    cast("StandardCost" as decimal(19,4)) as standard_cost,
    cast("ListPrice" as decimal(19,4)) as list_price,
    cast("SellStartDate" as timestamp) as sell_start_date,
    cast("SellEndDate" as timestamp) as sell_end_date,
    cast("DiscontinuedDate" as timestamp) as discontinued_date,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'product') }}
