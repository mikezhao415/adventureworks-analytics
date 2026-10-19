select customer_id as customer_key,person_id,store_id,
    coalesce(territory_id,-1)::integer as current_territory_key,
    case when person_id is not null and store_id is not null then 'person_and_store'
         when person_id is not null then 'person' when store_id is not null then 'store'
         else 'unspecified' end::varchar as customer_type,
    modified_date as source_modified_at
from {{ ref('stg_customer') }}
