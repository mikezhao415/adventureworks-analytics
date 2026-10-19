select
    cast("SalesOrderID" as integer) as sales_order_id,
    cast("OrderDate" as timestamp) as order_date,
    cast("DueDate" as timestamp) as due_date,
    cast("ShipDate" as timestamp) as ship_date,
    cast("Status" as integer) as status,
    cast("OnlineOrderFlag" as boolean) as online_order_flag,
    cast("CustomerID" as integer) as customer_id,
    cast("TerritoryID" as integer) as territory_id,
    cast("SubTotal" as decimal(19,4)) as sub_total,
    cast("TaxAmt" as decimal(19,4)) as tax_amt,
    cast("Freight" as decimal(19,4)) as freight,
    cast("TotalDue" as decimal(19,4)) as total_due,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'sales_order_header') }}
