"""Build a new validated DuckDB/dbt analytical artifact from an Issue #4 snapshot."""
import argparse
import datetime as dt
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import uuid

import duckdb
import pyarrow as pa
import yaml

from src.analytics_validation import reconcile, snake
from src.contracts import TABLES
from src.extract import (ValidationError, atomic_json, digest, validate_snapshot,
                         publication_lock, finalize_directory)

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT/'dbt'/'adventureworks'


def resolve_snapshot(root):
    root = Path(root).resolve()
    pointer = json.loads((root/'current.json').read_text(encoding='utf-8'))
    snapshot_id = pointer['snapshot_id']
    if not re.fullmatch(r'[A-Za-z0-9_-]+',snapshot_id):
        raise ValidationError('Unsafe snapshot ID')
    snapshot = root/snapshot_id
    if digest(snapshot/'manifest.json') != pointer['manifest_sha256']:
        raise ValidationError('Current snapshot manifest checksum differs')
    validation = validate_snapshot(snapshot)
    if validation['input_fingerprint'] != pointer['input_fingerprint']:
        raise ValidationError('Current snapshot fingerprint differs')
    return snapshot,pointer


def load_raw(database, snapshot):
    connection = duckdb.connect(str(database))
    try:
        connection.execute('create schema raw')
        for table in TABLES:
            definitions = []
            for field in table['schema']:
                t = field.type
                sql_type = (f'decimal({t.precision},{t.scale})' if pa.types.is_decimal(t) else
                            'timestamp' if pa.types.is_timestamp(t) else 'integer' if pa.types.is_integer(t) else
                            'boolean' if pa.types.is_boolean(t) else 'varchar')
                definitions.append('"'+field.name+'" '+sql_type+('' if field.nullable else ' not null'))
            name = snake(table['name'].split('.')[1])
            connection.execute('create table raw.'+name+' ('+','.join(definitions)+')')
            file = snapshot/(table['name'].replace('.','_')+'.parquet')
            connection.execute('insert into raw.'+name+' select * from read_parquet(?)',[str(file)])
    finally:
        connection.close()


def dbt(stage, action='build', selection=None):
    environment = dict(os.environ,AW_ANALYTICS_DB=str((stage/'analytics.duckdb').resolve()),
                       DBT_SEND_ANONYMOUS_USAGE_STATS='false')
    executable = Path(sys.executable).parent/('dbt.exe' if os.name=='nt' else 'dbt')
    command = [str(executable),action,'--project-dir',str(PROJECT),'--profiles-dir',str(PROJECT),
               '--target-path',str((stage/'dbt-target').resolve()),'--log-path',str((stage/'dbt-logs').resolve())]
    if selection:
        command += ['--select',selection]
    with (stage/('dbt-'+action+'.log')).open('w',encoding='utf-8') as log:
        code = subprocess.run(command,env=environment,stdout=log,stderr=subprocess.STDOUT,check=False).returncode
    return code


def build(snapshot_root=ROOT/'output'/'adventureworks', output_root=ROOT/'output'/'analytics'):
    snapshot,pointer = resolve_snapshot(snapshot_root)
    output_root = Path(output_root).resolve()
    with publication_lock(output_root):
        run_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ-')+uuid.uuid4().hex
        stage = output_root/('.staging-'+run_id)
        stage.mkdir()
        try:
            load_raw(stage/'analytics.duckdb',snapshot)
            if dbt(stage):
                raise ValidationError('Real-source dbt build failed; inspect retained failure log')
            specs = yaml.safe_load((PROJECT/'models'/'schema.yml').read_text(encoding='utf-8'))['models']
            connection = duckdb.connect(str(stage/'analytics.duckdb'),read_only=True)
            try:
                result = reconcile(connection,snapshot,specs)
            finally:
                connection.close()
            # Catch input changes during consumption; the raw copy and artifacts
            # never become current if the supplied snapshot has changed.
            validate_snapshot(snapshot)
            if digest(snapshot/'manifest.json') != pointer['manifest_sha256']:
                raise ValidationError('Snapshot manifest changed during build')
            revision = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
            dirty = bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip())
            dbt_results = json.loads((stage/'dbt-target'/'run_results.json').read_text(encoding='utf-8'))
            evidence = {'mode':'adventureworks_analytics','result':'pass','snapshot':pointer,
                        'code_revision':revision,'working_tree_dirty':dirty,
                        'validation_mode':json.loads((snapshot/'manifest.json').read_text(encoding='utf-8')).get(
                            'validation_mode','real_adventureworks'),
                        'environment':{'python':platform.python_version(),'platform':platform.system(),
                            **{name:importlib.metadata.version(name) for name in ('duckdb','dbt-core','dbt-duckdb','pyarrow')}},
                        'dbt_results':{status:sum(r['status']==status for r in dbt_results['results'])
                                       for status in sorted({r['status'] for r in dbt_results['results']})},
                        **result,'limitations':['Current snapshot dimensions, no historical SCD/cost reconstruction.',
                            'Source monetary units; currency conversion/denomination not established.',
                            'Shipped orders only in marts; no returns or recognized-revenue model.']}
            atomic_json(stage/'evidence.json',evidence)
            final = output_root/run_id
            finalize_directory(stage,final)
            atomic_json(output_root/'current.json',{'run_id':run_id,'evidence_sha256':digest(final/'evidence.json'),
                        'database_sha256':digest(final/'analytics.duckdb'),'snapshot_id':pointer['snapshot_id']})
            return final,evidence
        except BaseException as error:
            # Failure diagnostics remain local and contain no credentials. Keep
            # dbt logs/results for review, but never publish an invalid database.
            failed = output_root/('failed-'+run_id)
            failed.mkdir()
            for file in ('dbt-build.log','dbt-test.log'):
                if (stage/file).exists():
                    shutil.copyfile(stage/file,failed/file)
            if (stage/'dbt-target'/'run_results.json').exists():
                shutil.copyfile(stage/'dbt-target'/'run_results.json',failed/'run_results.json')
            atomic_json(failed/'failure.json',{'result':'fail','run_id':run_id,
                        'snapshot':pointer,'error_type':type(error).__name__})
            raise
        finally:
            if stage.exists():
                shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot-root',type=Path,default=ROOT/'output'/'adventureworks')
    parser.add_argument('--output-root',type=Path,default=ROOT/'output'/'analytics')
    args = parser.parse_args()
    path,evidence = build(args.snapshot_root,args.output_root)
    print('PASS: '+str(path)+'; '+str(len(evidence['models']))+' models independently reconciled')


if __name__=='__main__':
    main()
