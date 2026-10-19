select p.product_id as product_key,p.name as product_name,p.product_number,p.color,
    p.product_subcategory_id as subcategory_id,s.name as subcategory_name,
    coalesce(s.product_category_id,-1)::integer as category_key,
    p.standard_cost as current_standard_cost,p.list_price as current_list_price,
    p.sell_start_date,p.sell_end_date,p.discontinued_date,p.modified_date as source_modified_at
from {{ ref('stg_product') }} p
left join {{ ref('stg_product_subcategory') }} s on s.product_subcategory_id=p.product_subcategory_id
