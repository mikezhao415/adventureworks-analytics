with bounds as (
    select min(order_date)::date as first_date,max(order_date)::date as last_date
    from {{ ref('stg_sales_order_header') }}
), dates as (
    select value::date as calendar_date from bounds,
    lateral generate_series(first_date,last_date,interval 1 day) s(value)
)
select strftime(calendar_date,'%Y%m%d')::integer as date_key,calendar_date,
    year(calendar_date)::integer as calendar_year,quarter(calendar_date)::integer as calendar_quarter,
    month(calendar_date)::integer as month_number,date_trunc('month',calendar_date)::date as sales_month,
    isodow(calendar_date)::integer as iso_day_of_week
from dates
