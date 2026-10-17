select tenant_id, date_trunc('month',order_date)::date as sales_month, count(distinct order_id) as orders, sum(quantity)::bigint as units, sum(amount)::decimal(18,4) as net_sales
from {{ ref('fct_sales_lines') }}
group by 1,2
