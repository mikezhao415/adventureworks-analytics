"""Offline snapshot regressions; no SQL Server environment or credentials required."""
from copy import deepcopy
from decimal import Decimal
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pyarrow as pa

from src.contracts import TABLES, RELATIONSHIPS
from src.extract import extract, validate_snapshot, ValidationError, publication_lock
from src.sql_source import read_records, sqlcmd, SourceError


def records():
    result = [{'kind': 'source', 'database_name': 'AdventureWorks2022',
               'server_version': 'offline-test', 'started_utc': '2026-01-01T00:00:00'}]
    for table in TABLES:
        row = {}
        for field in table['schema']:
            if pa.types.is_timestamp(field.type):
                value, sql_type, precision, scale = '2014-01-01T00:00:00', 'datetime', 23, 3
            elif pa.types.is_decimal(field.type):
                value = Decimal('1.0000')
                sql_type, precision, scale = ('numeric',38,6) if field.name == 'LineTotal' else (
                    ('smallmoney',10,4) if field.name == 'DiscountPct' else ('money',19,4))
            elif pa.types.is_boolean(field.type):
                value, sql_type, precision, scale = True, 'bit', 1, 0
            elif pa.types.is_string(field.type):
                value, sql_type, precision, scale = 'Bicycle 漢字 "\\', 'nvarchar', 0, 0
            else:
                value = 1
                sql_type, precision, scale = ('smallint',5,0) if field.name == 'OrderQty' else (
                    ('tinyint',3,0) if field.name == 'Status' else ('int',10,0))
            row[field.name] = value
            result.append({'kind':'schema','table_name':table['name'],'name':field.name,
                           'base_type':sql_type,'precision':precision,'scale':scale,
                           'is_nullable':field.nullable})
        if table['name'] == 'Sales.SalesOrderHeader':
            row.update(SubTotal=Decimal('.5001'),TaxAmt=Decimal('.1000'),
                       Freight=Decimal('.2000'),TotalDue=Decimal('.8001'))
        if table['name'] == 'Sales.SalesOrderDetail':
            row.update(UnitPrice=Decimal('1.0001'),UnitPriceDiscount=Decimal('.5000'),
                       LineTotal=Decimal('.500050'))
        result += [{'kind':'count','table_name':table['name'],'row_count':1},
                   {'kind':'row','table_name':table['name'],**row}]
    money = {'orders':1,'subtotal':Decimal('.5001'),'tax':Decimal('.1000'),
             'freight':Decimal('.2000'),'due':Decimal('.8001')}
    result += [{'kind':'quality','metric':'duplicate:'+t['name'],'violations':0} for t in TABLES]
    result += [{'kind':'quality','metric':'orphan:'+c+'->'+p,'violations':0} for c,_,p,_ in RELATIONSHIPS]
    result += [{'kind':'headers', **money, 'first_order':'2014-01-01T00:00:00',
                'last_order':'2014-01-01T00:00:00'},
               {'kind':'lines','lines':1,'units':1,'line_total':Decimal('.500050')},
               {'kind':'monthly','month':'2014-01','status':1,**money}, {'kind':'complete'}]
    return result


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {'AW_SQL_USER':'offline','AW_SQL_PASSWORD':'offline'})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def run_snapshot(self, data=None):
        data = records() if data is None else data
        return extract(self.root, provider=lambda *_: data)

    def test_rounding_unicode_and_repeated_content(self):
        first, a = self.run_snapshot()
        second, b = self.run_snapshot()
        self.assertNotEqual(first, second)
        self.assertEqual(a['input_fingerprint'], b['input_fingerprint'])
        self.assertEqual(a['controls']['lines']['line_total'], Decimal('.500050'))
        self.assertEqual(validate_snapshot(first)['result'], 'pass')
        self.assertEqual({p.name for p in first.iterdir()},
                         {t['name'].replace('.','_')+'.parquet' for t in TABLES} | {'manifest.json','validation.json'})

    def test_corrupt_file_and_manifest_are_rejected(self):
        path, _ = self.run_snapshot()
        file = next(path.glob('*.parquet'))
        file.write_bytes(file.read_bytes() + b'corruption')
        with self.assertRaisesRegex(ValidationError, 'checksum'):
            validate_snapshot(path)
        path, _ = self.run_snapshot()
        manifest = json.loads((path/'manifest.json').read_text())
        manifest['tables'].pop()
        (path/'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValidationError, 'table set'):
            validate_snapshot(path)

    def test_rejections_preserve_known_good_snapshot(self):
        path, _ = self.run_snapshot()
        pointer = (self.root/'current.json').read_bytes()
        original = (path/'manifest.json').read_bytes()
        cases = []
        data = records()
        next(r for r in data if r['kind']=='headers')['subtotal'] += Decimal('.01')
        cases.append((data, 'Independent source'))
        data = records()
        next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SalesOrderDetail')['SalesOrderID'] = 999
        cases.append((data, 'Orphan relationship'))
        data = records()
        row = next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SalesOrderDetail')
        data.insert(-1, deepcopy(row))
        next(r for r in data if r['kind']=='count' and r['table_name']==row['table_name'])['row_count'] = 2
        cases.append((data, 'Duplicate or unsorted'))
        data = records()
        next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SalesOrderHeader')['SubTotal'] = Decimal('.5000')
        cases.append((data, 'Per-order financial'))
        data = records()
        next(r for r in data if r['kind']=='schema' and r['name']=='LineTotal')['scale'] = 4
        cases.append((data, 'decimal drift'))
        data = records()
        next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.Customer')['CustomerID'] = None
        cases.append((data, 'Required value'))
        data = records()
        data[:] = [r for r in data if not (r['kind']=='row' and r['table_name']=='Sales.Customer')]
        cases.append((data, 'row count'))
        data = records()
        next(r for r in data if r['kind']=='row' and r['table_name']=='Sales.SalesOrderDetail')['LineTotal'] = Decimal('.500051')
        cases.append((data, 'Line financial'))
        data = records()
        next(r for r in data if r['kind']=='quality')['violations'] = 1
        cases.append((data, 'Independent source'))
        for data, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(ValidationError, message):
                self.run_snapshot(data)
            self.assertEqual((self.root/'current.json').read_bytes(), pointer)
            self.assertEqual((path/'manifest.json').read_bytes(), original)
            self.assertFalse(list(self.root.glob('.staging-*')))

    def test_interrupted_pointer_update_and_concurrent_run(self):
        path, _ = self.run_snapshot()
        before = (self.root/'current.json').read_bytes()
        import src.extract as module
        original = module.atomic_json
        def fail_pointer(file, value):
            if file.name == 'current.json':
                raise OSError('injected publication failure')
            return original(file, value)
        with patch('src.extract.atomic_json', side_effect=fail_pointer), self.assertRaises(OSError):
            self.run_snapshot()
        self.assertEqual((self.root/'current.json').read_bytes(), before)
        self.assertEqual(validate_snapshot(path)['result'], 'pass')
        with publication_lock(self.root), self.assertRaisesRegex(ValidationError, 'publication lock'):
            self.run_snapshot()

    def test_transport_requires_commit_marker_and_preserves_credential_bytes(self):
        with patch('src.sql_source.sqlcmd', return_value='{"kind":"source"}\n'):
            with self.assertRaisesRegex(SourceError, 'did not complete'):
                read_records('reader','secret')
        with patch.dict(os.environ, {'AW_CONTAINER':'existing-sql'}), patch('src.sql_source.subprocess.run') as run:
            run.return_value.returncode = 0
            run.return_value.stdout = b'{"kind":"complete"}\n'
            self.assertEqual(sqlcmd('SELECT 1;', 'reader', 'secret!'), '{"kind":"complete"}\n')
            self.assertEqual(run.call_args.kwargs['input'], b'secret!\nSELECT 1;')
            self.assertNotIn('secret!', ' '.join(run.call_args.args[0]))
            self.assertNotIn('-h', run.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
