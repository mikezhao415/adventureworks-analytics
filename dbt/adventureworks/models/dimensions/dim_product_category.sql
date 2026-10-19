select product_category_id as category_key,name as category_name,modified_date as source_modified_at
from {{ ref('stg_product_category') }}
union all select -1::integer,'Uncategorized'::varchar,null::timestamp
