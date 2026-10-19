-- A line/header join must preserve both the source key set and its cardinality.
with header_delta as (
    (select sales_order_id from {{ ref('fct_sales_orders') }}
     except all select sales_order_id from {{ ref('stg_sales_order_header') }})
    union all
    (select sales_order_id from {{ ref('stg_sales_order_header') }}
     except all select sales_order_id from {{ ref('fct_sales_orders') }})
), line_delta as (
    (select sales_order_id,sales_order_detail_id from {{ ref('fct_sales_order_lines') }}
     except all select sales_order_id,sales_order_detail_id from {{ ref('stg_sales_order_detail') }})
    union all
    (select sales_order_id,sales_order_detail_id from {{ ref('stg_sales_order_detail') }}
     except all select sales_order_id,sales_order_detail_id from {{ ref('fct_sales_order_lines') }})
)
select 'header' as violation from header_delta union all select 'line' from line_delta
