"""Local/manual real-snapshot repeatability and deliberate analytical corruption checks."""
import argparse
import json
from pathlib import Path
import shutil

import duckdb
import yaml

from src.analytics import build, dbt, resolve_snapshot, PROJECT, ROOT
from src.analytics_validation import reconcile
from src.extract import ValidationError, atomic_json


NEGATIVE_CASES = [
    ('duplicate_fact','insert into fct_sales_order_lines select * from fct_sales_order_lines limit 1','aw_fact_grain'),
    ('missing_dimension','delete from dim_customer','aw_dimension_relationships'),
    ('wrong_line','update fct_sales_order_lines set net_line_sales=net_line_sales+.000001','aw_financial_reconciliation'),
    ('fanout_dimension','insert into dim_product select * from dim_product limit 1','aw_dimension_grain'),
    ('wrong_mart','update mart_sales_summary set header_subtotal=header_subtotal+1','aw_mart_reconciliation'),
]


def negative_checks(validated, snapshot, root):
    specifications = yaml.safe_load((PROJECT/'models'/'schema.yml').read_text(encoding='utf-8'))['models']
    root.mkdir(parents=True)
    evidence = []
    for name,sql,test in NEGATIVE_CASES:
        stage = root/name
        stage.mkdir()
        shutil.copyfile(validated/'analytics.duckdb',stage/'analytics.duckdb')
        connection = duckdb.connect(str(stage/'analytics.duckdb'))
        try:
            connection.execute(sql)
            try:
                reconcile(connection,snapshot,specifications)
            except ValidationError as error:
                reason = str(error)
            else:
                raise ValidationError('Independent validation accepted corruption: '+name)
        finally:
            connection.close()
        code = dbt(stage,'test',test)
        result = json.loads((stage/'dbt-target'/'run_results.json').read_text(encoding='utf-8'))['results']
        if code==0 or len(result)!=1 or result[0]['status']!='fail' or result[0]['unique_id'].split('.')[-1]!=test:
            raise ValidationError('Corruption failed for an unexpected reason: '+name)
        evidence.append({'scenario':name,'dbt_test':test,'dbt_status':'fail',
                         'expected_rejection':'pass','independent_rejection':reason})
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot-root',type=Path,default=ROOT/'output'/'adventureworks')
    parser.add_argument('--output-root',type=Path,default=ROOT/'output'/'analytics')
    args = parser.parse_args()
    first,a = build(args.snapshot_root,args.output_root)
    second,b = build(args.snapshot_root,args.output_root)
    if a['snapshot']!=b['snapshot'] or a['models']!=b['models'] or a['eligible_totals']!=b['eligible_totals']:
        raise ValidationError('Snapshot-to-mart repeatability failed')
    snapshot,_ = resolve_snapshot(args.snapshot_root)
    current = (args.output_root/'current.json').read_bytes()
    negative = negative_checks(second,snapshot,args.output_root/('negative-'+second.name))
    if (args.output_root/'current.json').read_bytes()!=current:
        raise ValidationError('Negative checks changed the published result')
    atomic_json(args.output_root/'integration-evidence.json',{
        'mode':'adventureworks_analytics','result':'pass','runs':[first.name,second.name],
        'snapshot':a['snapshot'],'code_revision':a['code_revision'],'working_tree_dirty':a['working_tree_dirty'],
        'environment':a['environment'],'models':a['models'],'eligible_totals':a['eligible_totals'],
        'repeatability':'pass','negative_checks':negative})
    print('PASS: two real snapshot-to-mart builds and five targeted negative scenarios')
    print('Evidence: '+str(args.output_root/'integration-evidence.json'))


if __name__=='__main__':
    main()
