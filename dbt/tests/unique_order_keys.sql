select tenant_id, order_id from {{ ref('stg_orders') }} group by 1,2 having count(*) > 1
