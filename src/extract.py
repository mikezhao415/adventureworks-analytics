"""Opt-in AdventureWorks extraction, independent validation and atomic publication.

Run from the repository root: python -m src.extract --help
"""
import argparse
from contextlib import contextmanager
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP, localcontext
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import time
import uuid

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq
from dotenv import load_dotenv

from src.contracts import TABLES, RELATIONSHIPS, VERSION
from src.sql_source import read_records, SourceError


class ValidationError(RuntimeError):
    pass


def encode(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    raise TypeError(type(value).__name__)


def canonical(value):
    return json.dumps(value, default=encode, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def schema_description(schema):
    return [{'name': f.name, 'type': str(f.type), 'nullable': f.nullable} for f in schema]


def typed_row(contract, record):
    if set(record) != set(contract['schema'].names):
        raise ValidationError('Column set differs: ' + contract['name'])
    result = {}
    for field in contract['schema']:
        value = record[field.name]
        if value is None:
            if not field.nullable:
                raise ValidationError('Required value missing: ' + field.name)
        elif pa.types.is_decimal(field.type):
            value = Decimal(str(value))
            with localcontext() as context:
                context.prec = 60
                normalized = value.quantize(Decimal(1).scaleb(-field.type.scale))
            if normalized != value:
                raise ValidationError('Decimal scale would lose precision: ' + field.name)
            value = normalized
        elif pa.types.is_timestamp(field.type):
            value = dt.datetime.fromisoformat(value)
            if value.tzinfo is not None:
                raise ValidationError('Source datetime unexpectedly has a timezone')
        elif pa.types.is_boolean(field.type):
            if value not in (True, False, 0, 1):
                raise ValidationError('Invalid boolean')
            value = bool(value)
        elif pa.types.is_integer(field.type):
            if not isinstance(value, int) or isinstance(value, bool):
                raise ValidationError('Invalid integer')
        elif not isinstance(value, str):
            raise ValidationError('Invalid string')
        result[field.name] = value
    return result


def check_source_schema(contract, metadata):
    if len({m['name'] for m in metadata}) != len(metadata):
        raise ValidationError('Duplicate source schema metadata')
    by_name = {m['name']: m for m in metadata}
    for field in contract['schema']:
        m = by_name.get(field.name)
        if m is None or bool(m['is_nullable']) != field.nullable:
            raise ValidationError('Source nullability/column drift: ' + field.name)
        if pa.types.is_decimal(field.type):
            expected = ('numeric', 38, 6) if field.name == 'LineTotal' else (
                ('smallmoney', 10, 4) if field.name == 'DiscountPct' else ('money', 19, 4))
            if (m['base_type'], m['precision'], m['scale']) != expected:
                raise ValidationError('Source decimal drift: ' + field.name)
        else:
            expected = 'datetime' if pa.types.is_timestamp(field.type) else (
                'bit' if pa.types.is_boolean(field.type) else (
                    'nvarchar' if pa.types.is_string(field.type) else (
                        'smallint' if field.name == 'OrderQty' else (
                            'tinyint' if field.name == 'Status' else 'int'))))
            if m['base_type'] != expected:
                raise ValidationError('Source type drift: ' + field.name)
    return [by_name[f.name] for f in contract['schema']]


def write_tables(stage, records):
    expected = {t['name'] for t in TABLES}
    rows = {n: [] for n in expected}
    schemas = {n: [] for n in expected}
    counts = {}
    controls = {'monthly': [], 'quality': {}}
    source = None
    for record in records:
        item = dict(record)
        kind = item.pop('kind')
        if kind in ('row', 'schema', 'count'):
            name = item.pop('table_name')
            if name not in expected:
                raise ValidationError('Unexpected source table')
            if kind == 'row':
                rows[name].append(item)
            elif kind == 'schema':
                schemas[name].append(item)
            else:
                if name in counts:
                    raise ValidationError('Duplicate count control')
                counts[name] = item['row_count']
        elif kind == 'source' and source is None:
            source = item
        elif kind in ('headers', 'lines') and kind not in controls:
            controls[kind] = item
        elif kind == 'monthly':
            controls[kind].append(item)
        elif kind == 'quality':
            if item['metric'] in controls['quality']:
                raise ValidationError('Duplicate quality control')
            controls['quality'][item['metric']] = item['violations']
        elif kind != 'complete':
            raise ValidationError('Unexpected or duplicate source control')
    if set(counts) != expected or set(controls) != {'headers', 'lines', 'monthly', 'quality'} or source is None:
        raise ValidationError('Incomplete source controls')
    entries = []
    for contract in TABLES:
        name = contract['name']
        metadata = check_source_schema(contract, schemas[name])
        data = [typed_row(contract, row) for row in rows[name]]
        if len(data) != counts[name]:
            raise ValidationError('Source row count differs: ' + name)
        filename = name.replace('.', '_') + '.parquet'
        path = stage / filename
        pq.write_table(pa.Table.from_pylist(data, schema=contract['schema']), path,
                       compression='zstd', row_group_size=10000)
        logical = hashlib.sha256()
        for row in data:
            logical.update((canonical(row) + '\n').encode('utf-8'))
        entries.append({'table': name, 'file': filename, 'rows': len(data),
                        'schema': schema_description(contract['schema']), 'source_schema': metadata,
                        'sha256': digest(path), 'content_sha256': logical.hexdigest(),
                        'bytes': path.stat().st_size})
    return entries, controls, source


def financial_controls(con):
    headers = con.execute('''SELECT count(*) AS orders, sum(SubTotal) AS subtotal,
        sum(TaxAmt) AS tax,sum(Freight) AS freight,sum(TotalDue) AS due,
        min(OrderDate) AS first_order,max(OrderDate) AS last_order FROM h''').fetchone()
    lines = con.execute('SELECT count(*),sum(OrderQty),sum(LineTotal) FROM d').fetchone()
    monthly = con.execute('''SELECT strftime(OrderDate,'%Y-%m') AS month,Status AS status,
        count(*) AS orders,sum(SubTotal) AS subtotal,sum(TaxAmt) AS tax,
        sum(Freight) AS freight,sum(TotalDue) AS due FROM h GROUP BY 1,2 ORDER BY 1,2''').fetchall()
    quality = {}
    aliases = {t['name']: 't' + str(i) for i,t in enumerate(TABLES)}
    for table in TABLES:
        keys = ','.join('"'+k+'"' for k in table['keys'])
        quality['duplicate:'+table['name']] = con.execute(
            f'SELECT count(*) FROM (SELECT {keys} FROM {aliases[table["name"]]} GROUP BY {keys} HAVING count(*)>1)').fetchone()[0]
    for child, ck, parent, pk in RELATIONSHIPS:
        join = ' AND '.join('c."'+a+'"=p."'+b+'"' for a,b in zip(ck,pk))
        present = ' AND '.join('c."'+k+'" IS NOT NULL' for k in ck)
        quality['orphan:'+child+'->'+parent] = con.execute(
            f'SELECT count(*) FROM {aliases[child]} c LEFT JOIN {aliases[parent]} p ON {join} '
            f'WHERE {present} AND p."{pk[0]}" IS NULL').fetchone()[0]
    return {
        'headers': dict(zip(('orders','subtotal','tax','freight','due','first_order','last_order'), headers)),
        'lines': dict(zip(('lines','units','line_total'), lines)),
        'monthly': [dict(zip(('month','status','orders','subtotal','tax','freight','due'), r)) for r in monthly],
        'quality': quality,
    }


def comparable(value):
    if isinstance(value, dict):
        return {k: comparable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [comparable(v) for v in value]
    if isinstance(value, dt.datetime):
        return value.isoformat(timespec='milliseconds')
    if isinstance(value, str):
        try:
            return Decimal(value)
        except Exception:
            try:
                return dt.datetime.fromisoformat(value).isoformat(timespec='milliseconds')
            except ValueError:
                return value
    return value


def validate_snapshot(path):
    """Re-open files; never trust the extraction buffer as the validation oracle."""
    path = Path(path)
    manifest = json.loads((path / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('contract_version') != VERSION or manifest.get('mode') != 'adventureworks':
        raise ValidationError('Unsupported manifest contract/mode')
    entries = manifest['tables']
    if len(entries) != len(TABLES) or {e['table'] for e in entries} != {t['name'] for t in TABLES}:
        raise ValidationError('Manifest table set differs')
    con = duckdb.connect()
    try:
        for index, contract in enumerate(TABLES):
            entry = next(e for e in entries if e['table'] == contract['name'])
            filename = contract['name'].replace('.', '_') + '.parquet'
            if entry['file'] != filename:
                raise ValidationError('Unsafe or unexpected snapshot filename')
            file = path / filename
            if digest(file) != entry['sha256'] or file.stat().st_size != entry['bytes']:
                raise ValidationError('File checksum/size differs: ' + filename)
            if entry['schema'] != schema_description(contract['schema']):
                raise ValidationError('Manifest schema differs')
            check_source_schema(contract, entry['source_schema'])
            with file.open('rb') as stream:
                arrow = pq.read_table(stream)
            if arrow.schema != contract['schema'] or arrow.num_rows != entry['rows']:
                raise ValidationError('Parquet schema/count differs: ' + filename)
            logical = hashlib.sha256()
            previous = None
            for row in arrow.to_pylist():
                if any(row[f.name] is None for f in contract['schema'] if not f.nullable):
                    raise ValidationError('Required value missing')
                key = tuple(row[k] for k in contract['keys'])
                if previous is not None and key <= previous:
                    raise ValidationError('Duplicate or unsorted primary key: ' + filename)
                previous = key
                logical.update((canonical(row) + '\n').encode('utf-8'))
            if logical.hexdigest() != entry['content_sha256']:
                raise ValidationError('Logical content fingerprint differs')
            con.register('t' + str(index), arrow)
        aliases = {t['name']: 't' + str(i) for i,t in enumerate(TABLES)}
        for child, ck, parent, pk in RELATIONSHIPS:
            join = ' AND '.join('c."'+a+'"=p."'+b+'"' for a,b in zip(ck,pk))
            present = ' AND '.join('c."'+k+'" IS NOT NULL' for k in ck)
            n = con.execute(f'SELECT count(*) FROM {aliases[child]} c LEFT JOIN {aliases[parent]} p ON {join} '
                            f'WHERE {present} AND p."{pk[0]}" IS NULL').fetchone()[0]
            if n:
                raise ValidationError('Orphan relationship: ' + child + ' -> ' + parent)
        con.execute('CREATE VIEW h AS SELECT * FROM t0')
        con.execute('CREATE VIEW d AS SELECT * FROM t1')
        if con.execute('''SELECT count(*) FROM h LEFT JOIN
                (SELECT SalesOrderID,sum(LineTotal) AS amount FROM d GROUP BY 1) l USING(SalesOrderID)
                WHERE l.SalesOrderID IS NULL OR h.SubTotal<>round(l.amount,4)
                OR h.TotalDue<>h.SubTotal+h.TaxAmt+h.Freight''').fetchone()[0]:
            raise ValidationError('Per-order financial reconciliation failed')
        with localcontext() as context:
            context.prec = 60
            for row in con.execute('SELECT OrderQty,UnitPrice,UnitPriceDiscount,LineTotal FROM d').fetchall():
                qty, price, discount, amount = row
                expected = (price * (1-discount) * qty).quantize(Decimal('.000001'), rounding=ROUND_HALF_UP)
                if qty <= 0 or not Decimal(0) <= discount <= Decimal(1) or expected != amount:
                    raise ValidationError('Line financial reconciliation failed')
        controls = financial_controls(con)
        if comparable(controls) != comparable(manifest['source_controls']):
            raise ValidationError('Independent source financial controls differ')
        fingerprint = hashlib.sha256(canonical([
            {'table': e['table'], 'schema': e['schema'], 'source_schema': e['source_schema'],
             'rows': e['rows'], 'content_sha256': e['content_sha256']} for e in entries
        ]).encode('utf-8')).hexdigest()
        if fingerprint != manifest['input_fingerprint']:
            raise ValidationError('Input fingerprint differs')
        return {'result': 'pass', 'tables': len(entries), 'controls': controls,
                'input_fingerprint': fingerprint}
    finally:
        con.close()


@contextmanager
def publication_lock(root):
    root.mkdir(parents=True, exist_ok=True)
    lock = root / '.publish.lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValidationError('Another extraction holds the publication lock; inspect before removing a stale lock') from None
    try:
        os.close(descriptor)
        yield
    finally:
        lock.unlink()


def atomic_json(path, value):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(canonical(value) + '\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def finalize_directory(stage, final):
    # Windows scanners can briefly hold files after close. Never remove or
    # overwrite a destination; a persistent error still fails publication.
    for attempt in range(6):
        try:
            stage.rename(final)
            return
        except PermissionError:
            if attempt == 5:
                raise
            time.sleep(0.1 * (2 ** attempt))


def extract(root, provider=read_records):
    root = Path(root)
    with publication_lock(root):
        run_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex
        stage = root / ('.staging-' + run_id)
        stage.mkdir()
        try:
            user = os.environ.get('AW_SQL_USER', '')
            password = os.environ.get('AW_SQL_PASSWORD', '')
            if not user or not password:
                raise SourceError('Set AW_SQL_USER and AW_SQL_PASSWORD')
            entries, controls, source = write_tables(stage, provider(user, password))
            fingerprint = hashlib.sha256(canonical([
                {'table': e['table'], 'schema': e['schema'], 'source_schema': e['source_schema'],
                 'rows': e['rows'], 'content_sha256': e['content_sha256']} for e in entries
            ]).encode('utf-8')).hexdigest()
            revision = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
            dirty = bool(subprocess.run(['git','status','--porcelain'], capture_output=True, text=True, check=True).stdout.strip())
            manifest = {'contract_version': VERSION, 'mode': 'adventureworks', 'snapshot_id': run_id,
                        'code_revision': revision, 'working_tree_dirty': dirty, 'source': source,
                        'isolation': 'SERIALIZABLE', 'tables': entries, 'source_controls': controls,
                        'input_fingerprint': fingerprint,
                        'environment': {'python': platform.python_version(), 'platform': platform.system(),
                                        **{n: importlib.metadata.version(n) for n in ('duckdb','pyarrow')}},
                        'limitations': ['Source wall-clock datetime has no stored timezone.',
                                        'Selected columns only; no currency conversion or returns model.',
                                        'SERIALIZABLE reads may block writers; local/manual reproduction.']}
            atomic_json(stage / 'manifest.json', manifest)
            result = validate_snapshot(stage)
            atomic_json(stage / 'validation.json', result)
            final = root / run_id
            finalize_directory(stage, final)
            # Sole mutable publication marker; failures before replacement preserve the old marker.
            atomic_json(root / 'current.json', {'snapshot_id': run_id,
                        'manifest_sha256': digest(final / 'manifest.json'), 'input_fingerprint': fingerprint})
            return final, result
        except Exception as error:
            # Store categories only, never credentials, SQL output or source records.
            atomic_json(root / ('failure-' + run_id + '.json'),
                        {'mode': 'adventureworks', 'result': 'fail', 'error_type': type(error).__name__})
            raise
        finally:
            if stage.exists():
                shutil.rmtree(stage)


def main():
    load_dotenv(override=False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('output/adventureworks'))
    parser.add_argument('--validate', type=Path, help='Validate an existing immutable snapshot without SQL Server')
    args = parser.parse_args()
    try:
        if args.validate:
            result = validate_snapshot(args.validate)
            print('PASS: snapshot validation; fingerprint=' + result['input_fingerprint'])
        else:
            path, result = extract(args.root)
            print('PASS: snapshot=' + str(path) + '; fingerprint=' + result['input_fingerprint'])
        return 0
    except Exception as error:
        print('FAIL: ' + type(error).__name__ + '; no new current snapshot published')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
