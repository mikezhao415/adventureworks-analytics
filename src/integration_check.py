"""Opt-in checks against the existing real source; never modifies source rows."""
import argparse
from copy import deepcopy
from decimal import Decimal
import json
import os
from pathlib import Path

from dotenv import load_dotenv

from src.contracts import TABLES
from src.extract import extract, validate_snapshot, ValidationError, atomic_json, digest
from src.sql_source import sqlcmd, ident, read_records, SourceError


def check_permissions():
    queries = ["SET NOCOUNT ON; SELECT (SELECT 'permissions' AS kind, "
               "IS_SRVROLEMEMBER('sysadmin') AS sysadmin, IS_MEMBER('db_owner') AS db_owner, "
               "IS_MEMBER('db_datareader') AS broad_reader, "
               "HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS alter_database, "
               "HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE') AS create_table, "
               "HAS_PERMS_BY_NAME('Person.Password','OBJECT','SELECT') AS unrelated_select "
               "FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);"]
    for table in TABLES:
        name = table['name']
        queries.append("SELECT (SELECT 'table' AS kind, '" + name + "' AS table_name, " +
                       ','.join("HAS_PERMS_BY_NAME('"+name+"','OBJECT','"+p+"') AS "+ident(p.lower())
                                for p in ('SELECT','INSERT','UPDATE','DELETE','ALTER','CONTROL')) +
                       ' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);')
    output = sqlcmd('\n'.join(queries), os.environ['AW_SQL_USER'], os.environ['AW_SQL_PASSWORD'])
    results = [json.loads(line) for line in output.splitlines() if line.strip()]
    if len(results) != 10 or any(v != 0 for k,v in results[0].items() if k != 'kind'):
        raise ValidationError('Reader has unexpected broad permissions')
    for row in results[1:]:
        if row.get('select') != 1 or any(row.get(k) != 0 for k in ('insert','update','delete','alter','control')):
            raise ValidationError('Reader table permissions differ')
    return results


def main():
    load_dotenv(override=False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('output/adventureworks'))
    args = parser.parse_args()
    permissions = check_permissions()
    captured = []
    def capture(user, password):
        records = read_records(user, password)
        captured.extend(records)
        return records
    first, a = extract(args.root, provider=capture)
    first_manifest_hash = digest(first/'manifest.json')
    second, b = extract(args.root)
    if a['input_fingerprint'] != b['input_fingerprint'] or a['controls'] != b['controls']:
        raise ValidationError('Repeated extraction differs; source must be quiescent for this check')
    before = (args.root/'current.json').read_bytes()
    bad = deepcopy(captured)
    next(row for row in bad if row['kind']=='headers')['subtotal'] += Decimal('.01')
    try:
        extract(args.root, provider=lambda *_: bad)
    except ValidationError as error:
        if str(error) != 'Independent source financial controls differ':
            raise
    else:
        raise ValidationError('Corrupt source control was accepted')
    def disconnected(*_):
        raise SourceError('Injected transport interruption')
    try:
        extract(args.root, provider=disconnected)
    except SourceError:
        pass
    else:
        raise ValidationError('Interrupted extraction was accepted')
    if (args.root/'current.json').read_bytes() != before or digest(first/'manifest.json') != first_manifest_hash:
        raise ValidationError('Failure replaced a known-good result')
    validate_snapshot(first)
    validate_snapshot(second)
    evidence = {'mode':'adventureworks','result':'pass','snapshots':[first.name,second.name],
                'input_fingerprint':a['input_fingerprint'],'controls':a['controls'],
                'manifest_sha256':[first_manifest_hash,digest(second/'manifest.json')],
                'reader_permissions':permissions,'repeated_extraction':'pass',
                'corrupt_control_rejected':'pass','interruption_preserved_current':'pass',
                'limitations':['Local/manual; no database writes or concurrency load test.',
                               'Source must remain unchanged between repeated runs.']}
    atomic_json(args.root/'integration-evidence.json', evidence)
    print('PASS: two real-source extractions, reconciliation, permissions and failure preservation')
    print('Evidence: ' + str(args.root/'integration-evidence.json'))


if __name__ == '__main__':
    main()
