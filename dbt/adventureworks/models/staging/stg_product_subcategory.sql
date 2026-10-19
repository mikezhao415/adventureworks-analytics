select
    cast("ProductSubcategoryID" as integer) as product_subcategory_id,
    cast("ProductCategoryID" as integer) as product_category_id,
    cast("Name" as varchar) as name,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'product_subcategory') }}
