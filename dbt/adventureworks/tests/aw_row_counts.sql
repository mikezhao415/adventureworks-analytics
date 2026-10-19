{% for name in ['customer','product','product_category','product_subcategory','sales_order_header',
                'sales_order_detail','sales_territory','special_offer','special_offer_product'] %}
select 'stg_{{ name }}' as violation
where (select count(*) from {{ ref('stg_' ~ name) }})<>(select count(*) from {{ source('snapshot',name) }})
union all
{% endfor %}
{% for dim,source,extra in [('dim_customer','stg_customer',0),('dim_product','stg_product',0),
    ('dim_product_category','stg_product_category',1),('dim_territory','stg_sales_territory',1),
    ('dim_promotion','stg_special_offer',0),('fct_sales_orders','stg_sales_order_header',0),
    ('fct_sales_order_lines','stg_sales_order_detail',0)] %}
select '{{ dim }}' as violation
where (select count(*) from {{ ref(dim) }})<>(select count(*)+{{ extra }} from {{ ref(source) }})
union all
{% endfor %}
select 'dim_date' as violation
where (select count(*) from {{ ref('dim_date') }})<>
    (select date_diff('day',min(order_date)::date,max(order_date)::date)+1 from {{ ref('stg_sales_order_header') }})
