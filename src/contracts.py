"""Versioned, deliberately narrow AdventureWorks extraction contracts."""
import pyarrow as pa

VERSION = 1
I = pa.int32()
S = pa.string()
D = pa.timestamp('us')  # Source wall-clock datetime, no invented timezone.
M = pa.decimal128(19, 4)
L = pa.decimal128(38, 6)
B = pa.bool_()


def table(name, keys, columns):
    return {"name": name, "keys": keys, "schema": pa.schema([
        pa.field(n.rstrip('?'), t, nullable=n.endswith('?')) for n, t in columns
    ])}


TABLES = [
    table('Sales.SalesOrderHeader', ['SalesOrderID'], [
        ('SalesOrderID', I), ('OrderDate', D), ('DueDate', D), ('ShipDate?', D),
        ('Status', I), ('OnlineOrderFlag', B), ('CustomerID', I), ('TerritoryID?', I),
        ('SubTotal', M), ('TaxAmt', M), ('Freight', M), ('TotalDue', M), ('ModifiedDate', D)]),
    table('Sales.SalesOrderDetail', ['SalesOrderID', 'SalesOrderDetailID'], [
        ('SalesOrderID', I), ('SalesOrderDetailID', I), ('OrderQty', I), ('ProductID', I),
        ('SpecialOfferID', I), ('UnitPrice', M), ('UnitPriceDiscount', M),
        ('LineTotal', L), ('ModifiedDate', D)]),
    table('Sales.Customer', ['CustomerID'], [
        ('CustomerID', I), ('PersonID?', I), ('StoreID?', I), ('TerritoryID?', I),
        ('ModifiedDate', D)]),
    table('Sales.SalesTerritory', ['TerritoryID'], [
        ('TerritoryID', I), ('Name', S), ('CountryRegionCode', S), ('Group', S),
        ('ModifiedDate', D)]),
    table('Production.Product', ['ProductID'], [
        ('ProductID', I), ('Name', S), ('ProductNumber', S), ('Color?', S),
        ('ProductSubcategoryID?', I), ('StandardCost', M), ('ListPrice', M),
        ('SellStartDate', D), ('SellEndDate?', D), ('DiscontinuedDate?', D), ('ModifiedDate', D)]),
    table('Production.ProductSubcategory', ['ProductSubcategoryID'], [
        ('ProductSubcategoryID', I), ('ProductCategoryID', I), ('Name', S), ('ModifiedDate', D)]),
    table('Production.ProductCategory', ['ProductCategoryID'], [
        ('ProductCategoryID', I), ('Name', S), ('ModifiedDate', D)]),
    table('Sales.SpecialOffer', ['SpecialOfferID'], [
        ('SpecialOfferID', I), ('Description', S), ('DiscountPct', M), ('Type', S),
        ('Category', S), ('StartDate', D), ('EndDate', D), ('MinQty', I), ('MaxQty?', I),
        ('ModifiedDate', D)]),
    table('Sales.SpecialOfferProduct', ['SpecialOfferID', 'ProductID'], [
        ('SpecialOfferID', I), ('ProductID', I), ('ModifiedDate', D)]),
]

# Only relationships whose endpoints are included in this extraction contract.
RELATIONSHIPS = [
    ('Sales.SalesOrderDetail', ['SalesOrderID'], 'Sales.SalesOrderHeader', ['SalesOrderID']),
    ('Sales.SalesOrderHeader', ['CustomerID'], 'Sales.Customer', ['CustomerID']),
    ('Sales.SalesOrderHeader', ['TerritoryID'], 'Sales.SalesTerritory', ['TerritoryID']),
    ('Sales.Customer', ['TerritoryID'], 'Sales.SalesTerritory', ['TerritoryID']),
    ('Sales.SalesOrderDetail', ['SpecialOfferID', 'ProductID'], 'Sales.SpecialOfferProduct', ['SpecialOfferID', 'ProductID']),
    ('Sales.SpecialOfferProduct', ['ProductID'], 'Production.Product', ['ProductID']),
    ('Sales.SpecialOfferProduct', ['SpecialOfferID'], 'Sales.SpecialOffer', ['SpecialOfferID']),
    ('Production.Product', ['ProductSubcategoryID'], 'Production.ProductSubcategory', ['ProductSubcategoryID']),
    ('Production.ProductSubcategory', ['ProductCategoryID'], 'Production.ProductCategory', ['ProductCategoryID']),
]
