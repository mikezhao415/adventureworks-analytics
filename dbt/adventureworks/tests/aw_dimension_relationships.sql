select 'offer_product' as violation
from {{ ref('fct_sales_order_lines') }} l
left join {{ ref('stg_special_offer_product') }} p
  on p.special_offer_id=l.promotion_key and p.product_id=l.product_key
where p.special_offer_id is null
union all
select 'customer' from {{ ref('fct_sales_orders') }} f
left join {{ ref('dim_customer') }} d on d.customer_key=f.customer_key where d.customer_key is null
union all
select 'line_context' from {{ ref('fct_sales_order_lines') }} l
join {{ ref('fct_sales_orders') }} h using(sales_order_id)
where l.customer_key<>h.customer_key or l.territory_key<>h.territory_key
   or l.order_date_key<>h.order_date_key or l.is_sales_eligible<>h.is_sales_eligible
