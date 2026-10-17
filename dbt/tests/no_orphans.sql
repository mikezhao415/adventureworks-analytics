select l.tenant_id, l.line_id from {{ ref('stg_lines') }} l left join {{ ref('stg_orders') }} o on l.tenant_id=o.tenant_id and l.order_id=o.order_id where o.order_id is null
