"""Offline dimensional integration on small local Parquet fixtures, never SQL Server."""
from copy import deepcopy
import datetime as dt
from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

import duckdb
import yaml

from test_extraction import records
from src.analytics import build, dbt, resolve_snapshot, PROJECT
from src.analytics_validation import reconcile
from src.extract import extract, ValidationError, publication_lock, atomic_json


def dimensional_records(no_eligible=False):
    source = records()
    data = [r for r in source if r['kind'] in ('source','schema','quality','row')]
    header = next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SalesOrderHeader')
    line = next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SalesOrderDetail')
    header['Status'] = 5
    second = deepcopy(header)
    second.update(SalesOrderID=2,OrderDate='2014-02-01T00:00:00',TerritoryID=None,
                  SubTotal=Decimal('1.5000'),TaxAmt=Decimal('.2000'),Freight=Decimal('.3000'),TotalDue=Decimal('2.0000'))
    cancelled = deepcopy(header)
    cancelled.update(SalesOrderID=3,OrderDate='2014-03-01T00:00:00',Status=6)
    product = deepcopy(next(r for r in data if r['kind']=='row' and r['table_name']=='Production.Product'))
    product.update(ProductID=2,ProductNumber='P2',ProductSubcategoryID=None)
    offer_product = deepcopy(next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SpecialOfferProduct'))
    offer_product['ProductID'] = 2
    line2 = deepcopy(line)
    line2.update(SalesOrderID=2,SalesOrderDetailID=2,ProductID=2,OrderQty=3,
                 UnitPrice=Decimal('.3333'),UnitPriceDiscount=Decimal('0.0000'),LineTotal=Decimal('.999900'))
    line3 = deepcopy(line)
    line3.update(SalesOrderID=2,SalesOrderDetailID=3)
    line4 = deepcopy(line)
    line4.update(SalesOrderID=3,SalesOrderDetailID=4)
    data.extend([second,cancelled,product,offer_product,line2,line3,line4])
    customer = next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.Customer')
    customer['TerritoryID'] = None
    if no_eligible:
        header['Status'] = second['Status'] = 6
    for table in {r['table_name'] for r in data if r['kind']=='row'}:
        rows = [r for r in data if r['kind']=='row' and r['table_name']==table]
        keys = ('SalesOrderID','SalesOrderDetailID') if table.endswith('SalesOrderDetail') else (
            ('SpecialOfferID','ProductID') if table.endswith('SpecialOfferProduct') else
            {'Sales.SalesOrderHeader':('SalesOrderID',),'Sales.Customer':('CustomerID',),
             'Sales.SalesTerritory':('TerritoryID',),'Production.Product':('ProductID',),
             'Production.ProductCategory':('ProductCategoryID',),'Production.ProductSubcategory':('ProductSubcategoryID',),
             'Sales.SpecialOffer':('SpecialOfferID',)}[table])
        data = [r for r in data if not (r['kind']=='row' and r['table_name']==table)]
        data.extend(sorted(rows,key=lambda r:tuple(r[k] for k in keys)))
        data.append({'kind':'count','table_name':table,'row_count':len(rows)})
    def money(rows):
        return {'orders':len(rows),'subtotal':sum(r['SubTotal'] for r in rows),
                'tax':sum(r['TaxAmt'] for r in rows),'freight':sum(r['Freight'] for r in rows),
                'due':sum(r['TotalDue'] for r in rows)}
    headers = [header,second,cancelled]
    data.append({'kind':'headers',**money(headers),'first_order':header['OrderDate'],'last_order':cancelled['OrderDate']})
    data.append({'kind':'lines','lines':4,'units':6,'line_total':Decimal('2.500050')})
    for h in headers:
        data.append({'kind':'monthly','month':h['OrderDate'][:7],'status':h['Status'],**money([h])})
    data.append({'kind':'complete'})
    return data


class AnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        with patch.dict(os.environ,AW_SQL_USER='offline',AW_SQL_PASSWORD='offline'):
            extract(cls.root/'snapshots',validation_mode='offline_fixture',provider=lambda *_:dimensional_records())
        cls.path,cls.evidence = build(cls.root/'snapshots',cls.root/'analytics')
        if os.environ.get('AW_QUALITY_EVIDENCE'):
            atomic_json(Path(os.environ['AW_QUALITY_EVIDENCE'])/'offline-analytics.json',cls.evidence)
        cls.specifications = yaml.safe_load((PROJECT/'models'/'schema.yml').read_text())['models']

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_eligibility_rounding_and_unknown_members(self):
        totals = self.evidence['eligible_totals']
        self.assertEqual(totals['order_count'],2)
        self.assertEqual(totals['units_sold'],5)
        self.assertEqual(totals['net_line_sales'],Decimal('2.000000'))
        self.assertEqual(totals['header_subtotal'],Decimal('2.0001'))
        self.assertEqual(totals['average_order_value'],Decimal('1.0001'))
        self.assertEqual(len(self.evidence['models']),23)
        self.assertEqual(self.evidence['validation_mode'],'offline_fixture')
        con = duckdb.connect(str(self.path/'analytics.duckdb'),read_only=True)
        try:
            self.assertEqual(con.execute('select order_count from mart_sales_territory where territory_key=-1').fetchone(),(1,))
            self.assertEqual(con.execute('select units_sold from mart_sales_category where category_key=-1').fetchone(),(3,))
            self.assertEqual(con.execute('select sum(order_count) from mart_sales_product').fetchone(),(3,))
        finally:
            con.close()

    def test_repeatability(self):
        _,second = build(self.root/'snapshots',self.root/'analytics')
        self.assertEqual(self.evidence['models'],second['models'])
        self.assertEqual(self.evidence['eligible_totals'],second['eligible_totals'])

    def test_targeted_dbt_and_independent_rejections(self):
        scenarios = [
            ('duplicate_fact','insert into fct_sales_order_lines select * from fct_sales_order_lines limit 1','aw_fact_grain'),
            ('missing_dimension','delete from dim_customer','aw_dimension_relationships'),
            ('wrong_line','update fct_sales_order_lines set net_line_sales=net_line_sales+.000001 where sales_order_detail_id=1','aw_financial_reconciliation'),
            ('fanout_dimension','insert into dim_product select * from dim_product limit 1','aw_dimension_grain'),
            ('wrong_mart','update mart_sales_summary set header_subtotal=header_subtotal+1','aw_mart_reconciliation'),
            ('wrong_eligibility','update fct_sales_orders set is_sales_eligible=true where sales_order_id=3','aw_financial_reconciliation'),
        ]
        snapshot,_ = resolve_snapshot(self.root/'snapshots')
        negative_evidence = []
        for name,sql,test in scenarios:
            with self.subTest(scenario=name):
                stage = self.root/name
                stage.mkdir()
                shutil.copyfile(self.path/'analytics.duckdb',stage/'analytics.duckdb')
                con = duckdb.connect(str(stage/'analytics.duckdb'))
                con.execute(sql)
                with self.assertRaisesRegex(ValidationError,
                        {
                            'duplicate_fact':'Independent grain validation failed: fct_sales_order_lines',
                            'missing_dimension':'Independent row/metric reconciliation failed: dim_customer',
                            'wrong_line':'Independent row/metric reconciliation failed: fct_sales_order_lines',
                            'fanout_dimension':'Independent grain validation failed: dim_product',
                            'wrong_mart':'Independent row/metric reconciliation failed: mart_sales_summary',
                            'wrong_eligibility':'Independent row/metric reconciliation failed: fct_sales_orders',
                        }[name]) as rejection:
                    reconcile(con,snapshot,self.specifications)
                con.close()
                self.assertNotEqual(dbt(stage,'test',test),0)
                results = json.loads((stage/'dbt-target'/'run_results.json').read_text())['results']
                self.assertEqual(len(results),1)
                self.assertEqual(results[0]['unique_id'].split('.')[-1],test)
                self.assertEqual(results[0]['status'],'fail')
                negative_evidence.append({'scenario':name,'independent_rejection':str(rejection.exception),
                                          'dbt_test':test,'dbt_status':results[0]['status'],
                                          'expected_rejection':'pass'})
        if os.environ.get('AW_QUALITY_EVIDENCE'):
            atomic_json(Path(os.environ['AW_QUALITY_EVIDENCE'])/'offline-negative.json',
                        {'mode':'offline_fixture','result':'pass','scenarios':negative_evidence})

    def test_snapshot_tampering_and_failed_build_preserve_current(self):
        before = (self.root/'analytics'/'current.json').read_bytes()
        with patch('src.analytics.dbt',return_value=1), self.assertRaisesRegex(ValidationError,'dbt build failed'):
            build(self.root/'snapshots',self.root/'analytics')
        self.assertEqual((self.root/'analytics'/'current.json').read_bytes(),before)
        copied = self.root/'tampered'
        shutil.copytree(self.root/'snapshots',copied)
        pointer = json.loads((copied/'current.json').read_text())
        manifest = copied/pointer['snapshot_id']/'manifest.json'
        manifest.write_bytes(manifest.read_bytes()+b' ')
        with self.assertRaisesRegex(ValidationError,'manifest checksum'):
            build(copied,self.root/'analytics')
        self.assertEqual((self.root/'analytics'/'current.json').read_bytes(),before)

    def test_staging_schema_drift_is_rejected(self):
        database = self.root/'schema-drift.duckdb'
        shutil.copyfile(self.path/'analytics.duckdb',database)
        snapshot,_ = resolve_snapshot(self.root/'snapshots')
        con = duckdb.connect(str(database))
        try:
            con.execute('alter table stg_customer alter column customer_id type bigint')
            with self.assertRaisesRegex(ValidationError,'Analytical schema differs: stg_customer'):
                reconcile(con,snapshot,self.specifications)
        finally:
            con.close()

    def test_publication_failures_and_lock_preserve_current(self):
        import src.analytics as module
        before = (self.root/'analytics'/'current.json').read_bytes()
        original = module.atomic_json
        def fail_pointer(file, value):
            if file.name == 'current.json':
                raise OSError('injected pointer replacement failure')
            return original(file, value)
        with patch('src.analytics.atomic_json',side_effect=fail_pointer):
            with self.assertRaisesRegex(OSError,'injected pointer'):
                build(self.root/'snapshots',self.root/'analytics')
        self.assertEqual((self.root/'analytics'/'current.json').read_bytes(),before)
        for target,error in (('finalize_directory',OSError('injected finalization')),
                             ('load_raw',KeyboardInterrupt())):
            with self.subTest(error=type(error).__name__):
                with patch('src.analytics.'+target,side_effect=error):
                    with self.assertRaises(type(error)):
                        build(self.root/'snapshots',self.root/'analytics')
                self.assertEqual((self.root/'analytics'/'current.json').read_bytes(),before)
        with publication_lock(self.root/'analytics'):
            with self.assertRaisesRegex(ValidationError,'publication lock'):
                build(self.root/'snapshots',self.root/'analytics')
        self.assertFalse(list((self.root/'analytics').glob('.staging-*')))
        failures = [json.loads(p.read_text()) for p in (self.root/'analytics').glob('failed-*/failure.json')]
        self.assertTrue(any(f['error_type']=='KeyboardInterrupt' for f in failures))

    def test_no_eligible_orders(self):
        with patch.dict(os.environ,AW_SQL_USER='offline',AW_SQL_PASSWORD='offline'):
            extract(self.root/'no-eligible',validation_mode='offline_fixture',provider=lambda *_:dimensional_records(True))
        _,evidence = build(self.root/'no-eligible',self.root/'no-eligible-analytics')
        self.assertEqual(evidence['eligible_totals']['order_count'],0)
        self.assertIsNone(evidence['eligible_totals']['average_order_value'])
        self.assertEqual(evidence['models']['mart_sales_monthly']['rows'],0)


if __name__=='__main__':
    unittest.main()
