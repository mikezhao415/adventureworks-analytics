"""Deterministic fictional records for dashboard development, not AdventureWorks data."""
from collections import defaultdict
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP
from test_extraction import records
from src.contracts import TABLES


def dashboard_records():
    original = records()
    templates = {r['table_name']:r for r in original if r['kind']=='row'}
    data = {t['name']:[] for t in TABLES}
    def add(table, **changes):
        row = deepcopy(templates[table]); row.update(changes); data[table].append(row); return row
    for key,name in enumerate(('Bikes','Components','Clothing','Accessories'),1):
        add('Production.ProductCategory',ProductCategoryID=key,Name=name)
        add('Production.ProductSubcategory',ProductSubcategoryID=key,ProductCategoryID=key,Name=name)
    products = [('Trail 900',1,'1299.9500'),('Road 700',1,'899.9900'),('Carbon wheelset',2,'79.9500'),
                ('Trail pedals',2,'24.9900'),('Essential jersey',3,'39.5000'),('Storm jacket',3,'119.0000'),
                ('City commuter',1,'499.0000'),('Ride bottle',4,'9.9500')]
    for key,(name,category,price) in enumerate(products,1):
        add('Production.Product',ProductID=key,Name=name,ProductNumber=f'DEMO-{key:03}',
            ProductSubcategoryID=category,ListPrice=Decimal(price))
        add('Sales.SpecialOfferProduct',SpecialOfferID=1,ProductID=key)
    add('Sales.SpecialOffer',SpecialOfferID=1,Description='Fixture offer',DiscountPct=Decimal('.1000'))
    for key,(name,country,group) in enumerate((('Northwest','US','North America'),('Southwest','US','North America'),
                                              ('Europe','FR','Europe'),('Pacific','AU','Pacific')),1):
        add('Sales.SalesTerritory',TerritoryID=key,Name=name,CountryRegionCode=country,Group=group)
    for key in range(1,25):
        add('Sales.Customer',CustomerID=key,PersonID=key,StoreID=None,TerritoryID=1+(key%4))
    order_id = detail_id = 0
    for month_index in range(24):
        year,month = 2013+month_index//12,1+month_index%12
        for n in range(24):
            order_id += 1
            date = f'{year}-{month:02}-{1+(n*7)%28:02}T12:00:00'
            amounts=[]
            for line in range(2):
                detail_id += 1
                product = 1+(n+month_index+line*3)%8
                qty = 1+(n+line+month_index//6)%4
                price = Decimal(products[product-1][2]); discount = Decimal('.1000') if n%3==0 else Decimal('0.0000')
                amount = (qty*price*(1-discount)).quantize(Decimal('.000001'))
                amounts.append(amount)
                add('Sales.SalesOrderDetail',SalesOrderID=order_id,SalesOrderDetailID=detail_id,
                    ProductID=product,SpecialOfferID=1,OrderQty=qty,UnitPrice=price,
                    UnitPriceDiscount=discount,LineTotal=amount)
            subtotal = sum(amounts).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)
            tax = (subtotal*Decimal('.08')).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)
            freight=Decimal('8.0000')
            add('Sales.SalesOrderHeader',SalesOrderID=order_id,OrderDate=date,DueDate=date,ShipDate=date,
                Status=6 if n%13==0 else 5,CustomerID=1+n,
                TerritoryID=None if n==23 else 1+(n+month_index)%4,
                SubTotal=subtotal,TaxAmt=tax,Freight=freight,TotalDue=subtotal+tax+freight)
    result=[r for r in original if r['kind'] in ('schema','quality')]
    result.insert(0,{'kind':'source','database_name':'Fictional dashboard fixture',
                     'server_version':'offline-test','started_utc':'2026-01-01T00:00:00'})
    for contract in TABLES:
        table=contract['name']; ordered=sorted(data[table],key=lambda r:tuple(r[k] for k in contract['keys']))
        result.extend(ordered); result.append({'kind':'count','table_name':table,'row_count':len(ordered)})
    headers=data['Sales.SalesOrderHeader']; lines=data['Sales.SalesOrderDetail']
    def money(rows):
        return {'orders':len(rows),**{field:sum(r[column] for r in rows) for field,column in
                (('subtotal','SubTotal'),('tax','TaxAmt'),('freight','Freight'),('due','TotalDue'))}}
    result.append({'kind':'headers',**money(headers),'first_order':min(r['OrderDate'] for r in headers),
                   'last_order':max(r['OrderDate'] for r in headers)})
    result.append({'kind':'lines','lines':len(lines),'units':sum(r['OrderQty'] for r in lines),
                   'line_total':sum(r['LineTotal'] for r in lines)})
    monthly=defaultdict(list)
    for row in headers: monthly[(row['OrderDate'][:7],row['Status'])].append(row)
    for (month,status),group in sorted(monthly.items()):
        result.append({'kind':'monthly','month':month,'status':status,**money(group)})
    result.append({'kind':'complete'})
    return result
