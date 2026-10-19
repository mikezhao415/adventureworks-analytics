select territory_id as territory_key,name as territory_name,country_region_code,
    territory_group,modified_date as source_modified_at
from {{ ref('stg_sales_territory') }}
union all select -1::integer,'Unknown'::varchar,null::varchar,null::varchar,null::timestamp
