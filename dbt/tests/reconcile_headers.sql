with lines as (select tenant_id, order_id, sum(amount)::decimal(18,4) as line_total from {{ ref('stg_lines') }} group by 1,2)
select o.tenant_id,o.order_id from {{ ref('stg_orders') }} o left join lines l on o.tenant_id=l.tenant_id and o.order_id=l.order_id where l.order_id is null or o.subtotal <> l.line_total or o.total_due <> o.subtotal+o.tax+o.freight
