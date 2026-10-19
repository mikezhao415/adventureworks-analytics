-- Source-derived controls do not reuse facts as the oracle.
with expected as (
    select count(*)::bigint as order_count,sum(sub_total)::decimal(38,4) as header_subtotal,
        sum(tax_amt)::decimal(38,4) as tax,sum(freight)::decimal(38,4) as freight,
        sum(total_due)::decimal(38,4) as total_due
    from {{ ref('stg_sales_order_header') }} where status=5
), lines as (
    select sum(d.order_qty)::bigint as units_sold,sum(d.line_total)::decimal(38,6) as net_line_sales
    from {{ ref('stg_sales_order_detail') }} d
    join {{ ref('stg_sales_order_header') }} h using(sales_order_id) where h.status=5
)
select 'summary' as violation from {{ ref('mart_sales_summary') }} m cross join expected e cross join lines l
where m.order_count<>e.order_count or m.header_subtotal<>coalesce(e.header_subtotal,0)
   or m.tax<>coalesce(e.tax,0) or m.freight<>coalesce(e.freight,0) or m.total_due<>coalesce(e.total_due,0)
   or m.units_sold<>coalesce(l.units_sold,0) or m.net_line_sales<>coalesce(l.net_line_sales,0)
   or m.average_order_value is distinct from {{ average_order_value('coalesce(e.header_subtotal,0)','e.order_count') }}
{% for model in ['mart_sales_monthly','mart_sales_customer','mart_sales_territory'] %}
union all
select '{{ model }}' from expected e cross join lines l cross join (
    select coalesce(sum(order_count),0) as orders,coalesce(sum(units_sold),0) as units,
        coalesce(sum(net_line_sales),0) as sales,coalesce(sum(header_subtotal),0) as subtotal,
        coalesce(sum(tax),0) as tax,coalesce(sum(freight),0) as freight,coalesce(sum(total_due),0) as due
    from {{ ref(model) }}
) a where a.orders<>e.order_count or a.units<>coalesce(l.units_sold,0) or a.sales<>coalesce(l.net_line_sales,0)
    or a.subtotal<>coalesce(e.header_subtotal,0) or a.tax<>coalesce(e.tax,0)
    or a.freight<>coalesce(e.freight,0) or a.due<>coalesce(e.total_due,0)
{% endfor %}
{% for model in ['mart_sales_product','mart_sales_category'] %}
union all select '{{ model }}' from lines l cross join (
    select coalesce(sum(units_sold),0) as units,coalesce(sum(net_line_sales),0) as sales from {{ ref(model) }}
) a where a.units<>coalesce(l.units_sold,0) or a.sales<>coalesce(l.net_line_sales,0)
{% endfor %}
