with amounts as (
    select sales_order_id,sum(net_line_sales) as amount
    from {{ ref('fct_sales_order_lines') }} group by 1
), headers as (
    (select sales_order_id,subtotal,tax,freight,total_due,is_sales_eligible
     from {{ ref('fct_sales_orders') }}
     except all
     select sales_order_id,sub_total,tax_amt,freight,total_due,status=5
     from {{ ref('stg_sales_order_header') }})
    union all
    (select sales_order_id,sub_total,tax_amt,freight,total_due,status=5
     from {{ ref('stg_sales_order_header') }}
     except all
     select sales_order_id,subtotal,tax,freight,total_due,is_sales_eligible
     from {{ ref('fct_sales_orders') }})
), lines as (
    (select sales_order_id,sales_order_detail_id,quantity,unit_price,unit_price_discount,net_line_sales
     from {{ ref('fct_sales_order_lines') }}
     except all
     select sales_order_id,sales_order_detail_id,order_qty,unit_price,unit_price_discount,line_total
     from {{ ref('stg_sales_order_detail') }})
    union all
    (select sales_order_id,sales_order_detail_id,order_qty,unit_price,unit_price_discount,line_total
     from {{ ref('stg_sales_order_detail') }}
     except all
     select sales_order_id,sales_order_detail_id,quantity,unit_price,unit_price_discount,net_line_sales
     from {{ ref('fct_sales_order_lines') }})
)
select 'header_source' as violation from headers
union all select 'line_source' from lines
union all
select 'order_equation' from {{ ref('fct_sales_orders') }} h
left join amounts l using(sales_order_id)
where l.sales_order_id is null or h.subtotal<>round(l.amount,4)
   or h.total_due<>h.subtotal+h.tax+h.freight
