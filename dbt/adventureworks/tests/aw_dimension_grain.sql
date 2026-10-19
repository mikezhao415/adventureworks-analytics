{% for model,key in [('dim_customer','customer_key'),('dim_product','product_key'),
    ('dim_product_category','category_key'),('dim_territory','territory_key'),
    ('dim_date','date_key'),('dim_promotion','promotion_key')] %}
select '{{ model }}' as violation from {{ ref(model) }} group by {{ key }} having count(*)<>1
{% if not loop.last %}union all{% endif %}
{% endfor %}
