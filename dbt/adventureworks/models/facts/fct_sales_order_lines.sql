select d.sales_order_id,d.sales_order_detail_id,o.customer_key,o.territory_key,o.order_date_key,
    d.product_id as product_key,d.special_offer_id as promotion_key,d.order_qty as quantity,
    d.unit_price,d.unit_price_discount,d.line_total as net_line_sales,
    o.is_sales_eligible,d.modified_date as source_modified_at
from {{ ref('stg_sales_order_detail') }} d
join {{ ref('fct_sales_orders') }} o on o.sales_order_id=d.sales_order_id
