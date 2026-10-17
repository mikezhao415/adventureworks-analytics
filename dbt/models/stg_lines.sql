select tenant_id, line_id, order_id, product_id, quantity, cast(amount as decimal(18,4)) as amount
from {{ source('raw','raw_lines') }}
