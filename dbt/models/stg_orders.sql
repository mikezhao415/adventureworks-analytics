select tenant_id, order_id, order_date, cast(subtotal as decimal(18,4)) as subtotal, cast(tax as decimal(18,4)) as tax, cast(freight as decimal(18,4)) as freight, cast(total_due as decimal(18,4)) as total_due
from {{ source('raw','raw_orders') }}
