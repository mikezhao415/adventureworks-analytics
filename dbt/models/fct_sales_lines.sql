select l.tenant_id, l.line_id, l.order_id, l.product_id, l.quantity, l.amount, o.order_date
from {{ ref('stg_lines') }} l
inner join {{ ref('stg_orders') }} o on l.tenant_id=o.tenant_id and l.order_id=o.order_id
