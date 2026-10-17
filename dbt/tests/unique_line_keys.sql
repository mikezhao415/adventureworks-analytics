select tenant_id, line_id from {{ ref('stg_lines') }} group by 1,2 having count(*) > 1
