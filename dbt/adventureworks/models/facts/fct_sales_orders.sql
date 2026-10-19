select sales_order_id,customer_id as customer_key,coalesce(territory_id,-1)::integer as territory_key,
    strftime(order_date,'%Y%m%d')::integer as order_date_key,order_date as ordered_at,
    due_date as due_at,ship_date as shipped_at,status,online_order_flag,
    (status=5)::boolean as is_sales_eligible,sub_total as subtotal,tax_amt as tax,
    freight,total_due,modified_date as source_modified_at
from {{ ref('stg_sales_order_header') }}
