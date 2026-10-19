"""Independent Python oracle: Parquet records -> expected dimensional rows and KPIs.

Does not read dbt SQL or use staging/facts/marts to calculate expected values.
"""
from collections import defaultdict
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP, localcontext
import hashlib
import re

import pyarrow.parquet as pq

from src.contracts import TABLES
from src.extract import ValidationError, canonical


def snake(value):
    if value == 'Group':
        return 'territory_group'
    value = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', value)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', value).lower()


def bucket():
    return {'order_count':0, 'units_sold':0, 'net_line_sales':Decimal(0),
            'header_subtotal':Decimal(0), 'tax':Decimal(0), 'freight':Decimal(0),
            'total_due':Decimal(0)}


def expected_models(snapshot):
    raw = {}
    expected = {}
    for table in TABLES:
        with (snapshot/(table['name'].replace('.','_')+'.parquet')).open('rb') as stream:
            data = pq.read_table(stream).to_pylist()
        raw[table['name'].split('.')[1]] = data
        expected['stg_'+snake(table['name'].split('.')[1])] = [
            {snake(k):v for k,v in r.items()} for r in data]
    h = raw['SalesOrderHeader']
    details = raw['SalesOrderDetail']
    categories = {r['ProductSubcategoryID']:r for r in raw['ProductSubcategory']}
    product_category = {r['ProductID']:(categories[r['ProductSubcategoryID']]['ProductCategoryID']
                        if r['ProductSubcategoryID'] is not None else -1) for r in raw['Product']}
    expected['dim_customer'] = [dict(customer_key=r['CustomerID'],person_id=r['PersonID'],store_id=r['StoreID'],
        current_territory_key=r['TerritoryID'] if r['TerritoryID'] is not None else -1,
        customer_type=('person_and_store' if r['PersonID'] is not None and r['StoreID'] is not None else
                       'person' if r['PersonID'] is not None else 'store' if r['StoreID'] is not None else 'unspecified'),
        source_modified_at=r['ModifiedDate']) for r in raw['Customer']]
    expected['dim_territory'] = [dict(territory_key=r['TerritoryID'],territory_name=r['Name'],
        country_region_code=r['CountryRegionCode'],territory_group=r['Group'],source_modified_at=r['ModifiedDate'])
        for r in raw['SalesTerritory']] + [dict(territory_key=-1,territory_name='Unknown',
        country_region_code=None,territory_group=None,source_modified_at=None)]
    expected['dim_product_category'] = [dict(category_key=r['ProductCategoryID'],category_name=r['Name'],
        source_modified_at=r['ModifiedDate']) for r in raw['ProductCategory']] + [
        dict(category_key=-1,category_name='Uncategorized',source_modified_at=None)]
    expected['dim_product'] = [dict(product_key=r['ProductID'],product_name=r['Name'],product_number=r['ProductNumber'],
        color=r['Color'],subcategory_id=r['ProductSubcategoryID'],
        subcategory_name=categories[r['ProductSubcategoryID']]['Name'] if r['ProductSubcategoryID'] is not None else None,
        category_key=product_category[r['ProductID']],current_standard_cost=r['StandardCost'],
        current_list_price=r['ListPrice'],sell_start_date=r['SellStartDate'],sell_end_date=r['SellEndDate'],
        discontinued_date=r['DiscontinuedDate'],source_modified_at=r['ModifiedDate']) for r in raw['Product']]
    expected['dim_promotion'] = [dict(promotion_key=r['SpecialOfferID'],description=r['Description'],discount_pct=r['DiscountPct'],
        promotion_type=r['Type'],promotion_category=r['Category'],start_date=r['StartDate'],end_date=r['EndDate'],
        min_qty=r['MinQty'],max_qty=r['MaxQty'],source_modified_at=r['ModifiedDate']) for r in raw['SpecialOffer']]
    first,last = min(r['OrderDate'].date() for r in h),max(r['OrderDate'].date() for r in h)
    dates = [first+dt.timedelta(days=i) for i in range((last-first).days+1)]
    expected['dim_date'] = [dict(date_key=int(d.strftime('%Y%m%d')),calendar_date=d,calendar_year=d.year,
        calendar_quarter=(d.month-1)//3+1,month_number=d.month,sales_month=d.replace(day=1),
        iso_day_of_week=d.isoweekday()) for d in dates]
    expected['fct_sales_orders'] = [dict(sales_order_id=r['SalesOrderID'],customer_key=r['CustomerID'],
        territory_key=r['TerritoryID'] if r['TerritoryID'] is not None else -1,
        order_date_key=int(r['OrderDate'].strftime('%Y%m%d')),ordered_at=r['OrderDate'],due_at=r['DueDate'],
        shipped_at=r['ShipDate'],status=r['Status'],online_order_flag=r['OnlineOrderFlag'],
        is_sales_eligible=r['Status']==5,subtotal=r['SubTotal'],tax=r['TaxAmt'],freight=r['Freight'],
        total_due=r['TotalDue'],source_modified_at=r['ModifiedDate']) for r in h]
    headers = {r['SalesOrderID']:r for r in h}
    expected['fct_sales_order_lines'] = []
    for r in details:
        order = headers[r['SalesOrderID']]
        expected['fct_sales_order_lines'].append(dict(sales_order_id=r['SalesOrderID'],sales_order_detail_id=r['SalesOrderDetailID'],
            customer_key=order['CustomerID'],territory_key=order['TerritoryID'] if order['TerritoryID'] is not None else -1,
            order_date_key=int(order['OrderDate'].strftime('%Y%m%d')),product_key=r['ProductID'],promotion_key=r['SpecialOfferID'],
            quantity=r['OrderQty'],unit_price=r['UnitPrice'],unit_price_discount=r['UnitPriceDiscount'],net_line_sales=r['LineTotal'],
            is_sales_eligible=order['Status']==5,source_modified_at=r['ModifiedDate']))
    grouped = {kind:defaultdict(bucket) for kind in ('summary','monthly','customer','territory')}
    grouped['summary'][1]  # Empty eligible set still has a zero-count summary.
    def groups(order):
        return [('summary',1),('monthly',order['OrderDate'].date().replace(day=1)),
                ('customer',order['CustomerID']),('territory',order['TerritoryID'] if order['TerritoryID'] is not None else -1)]
    with localcontext() as context:
        context.prec = 60
        for order in h:
            if order['Status'] != 5:
                continue
            for kind,key in groups(order):
                b = grouped[kind][key]
                b['order_count'] += 1
                for metric,source in [('header_subtotal','SubTotal'),('tax','TaxAmt'),('freight','Freight'),('total_due','TotalDue')]:
                    b[metric] += order[source]
        line_groups = {kind:defaultdict(lambda: {'orders':set(),'units_sold':0,'net_line_sales':Decimal(0)})
                       for kind in ('product','category')}
        for line in details:
            order = headers[line['SalesOrderID']]
            if order['Status'] != 5:
                continue
            for kind,key in groups(order):
                grouped[kind][key]['units_sold'] += line['OrderQty']
                grouped[kind][key]['net_line_sales'] += line['LineTotal']
            for kind,key in [('product',line['ProductID']),('category',product_category[line['ProductID']])]:
                b = line_groups[kind][key]
                b['orders'].add(order['SalesOrderID'])
                b['units_sold'] += line['OrderQty']
                b['net_line_sales'] += line['LineTotal']
        for kind,field in [('summary','summary_key'),('monthly','sales_month'),('customer','customer_key'),('territory','territory_key')]:
            rows = []
            for key,b in grouped[kind].items():
                average = ((b['header_subtotal']/b['order_count']).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)
                           if b['order_count'] else None)
                rows.append({field:key,**b,'average_order_value':average})
            expected['mart_sales_'+kind] = rows
        for kind,key in [('product','product_key'),('category','category_key')]:
            expected['mart_sales_'+kind] = [{key:k,'order_count':len(b['orders']),
                'units_sold':b['units_sold'],'net_line_sales':b['net_line_sales']} for k,b in line_groups[kind].items()]
    return expected


def reconcile(connection, snapshot, specifications):
    expected = expected_models(snapshot)
    results = {}
    for specification in specifications:
        name = specification['name']
        keys = specification['config']['meta']['grain_keys']
        columns = [c['name'] for c in specification['columns']]
        actual_schema = connection.execute('describe "'+name+'"').fetchall()
        if [(r[0],r[1].lower()) for r in actual_schema] != [(c['name'],c['data_type'].lower()) for c in specification['columns']]:
            raise ValidationError('Analytical schema differs: '+name)
        order = ','.join('"'+k+'"' for k in keys)
        rows = [dict(zip(columns,r)) for r in connection.execute('select * from "'+name+'" order by '+order).fetchall()]
        actual = {tuple(r[k] for k in keys):r for r in rows}
        wanted = {tuple(r[k] for k in keys):r for r in expected[name]}
        if len(rows) != len(actual) or any(None in key for key in actual):
            raise ValidationError('Independent grain validation failed: '+name)
        if actual != wanted:
            raise ValidationError('Independent row/metric reconciliation failed: '+name)
        h = hashlib.sha256()
        for row in rows:
            h.update((canonical(row)+'\n').encode('utf-8'))
        results[name] = {'rows':len(rows),'content_sha256':h.hexdigest()}
    return {'models':results,'eligible_totals':expected['mart_sales_summary'][0]}
