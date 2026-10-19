{% test grain(model, keys) %}
select {% for key in keys %}"{{ key }}"{% if not loop.last %},{% endif %}{% endfor %}
from {{ model }} group by {% for key in keys %}"{{ key }}"{% if not loop.last %},{% endif %}{% endfor %}
having count(*) > 1
{% endtest %}

{% macro average_order_value(subtotal, orders) %}
{# Integer arithmetic avoids DuckDB division's DOUBLE intermediary. Round half away from zero. #}
cast(cast(sign({{ subtotal }}) * (
    (abs(cast({{ subtotal }} * 10000 as hugeint))*2 + {{ orders }})
    // (2*nullif({{ orders }},0))) as decimal(38,0)) * cast(.0001 as decimal(5,4)) as decimal(38,4))
{% endmacro %}
