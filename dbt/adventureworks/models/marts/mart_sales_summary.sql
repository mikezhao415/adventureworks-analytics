with headers as (
    select 1::integer as summary_key,count(*)::bigint as order_count,
        coalesce(sum(h.subtotal),0)::decimal(38,4) as header_subtotal,
        coalesce(sum(h.tax),0)::decimal(38,4) as tax,coalesce(sum(h.freight),0)::decimal(38,4) as freight,
        coalesce(sum(h.total_due),0)::decimal(38,4) as total_due
    from {{ ref('fct_sales_orders') }} h
    join {{ ref('dim_date') }} dt on dt.date_key=h.order_date_key
    where h.is_sales_eligible
), lines as (
    select 1::integer as summary_key,coalesce(sum(l.quantity),0)::bigint as units_sold,
        coalesce(sum(l.net_line_sales),0)::decimal(38,6) as net_line_sales
    from {{ ref('fct_sales_order_lines') }} l
    join {{ ref('dim_date') }} dt on dt.date_key=l.order_date_key
    where l.is_sales_eligible
)
select h.summary_key,h.order_count,l.units_sold,l.net_line_sales,h.header_subtotal,h.tax,h.freight,h.total_due,
    {{ average_order_value('h.header_subtotal','h.order_count') }} as average_order_value
from headers h join lines l using (summary_key)
