select special_offer_id as promotion_key,description,discount_pct,type as promotion_type,
    category as promotion_category,start_date,end_date,min_qty,max_qty,modified_date as source_modified_at
from {{ ref('stg_special_offer') }}
