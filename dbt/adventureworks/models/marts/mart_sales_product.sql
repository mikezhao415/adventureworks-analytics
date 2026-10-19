select l.product_key as product_key,count(distinct l.sales_order_id)::bigint as order_count,
    sum(l.quantity)::bigint as units_sold,sum(l.net_line_sales)::decimal(38,6) as net_line_sales
from {{ ref('fct_sales_order_lines') }} l

where l.is_sales_eligible group by 1
