select
    cast("CustomerID" as integer) as customer_id,
    cast("PersonID" as integer) as person_id,
    cast("StoreID" as integer) as store_id,
    cast("TerritoryID" as integer) as territory_id,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'customer') }}
