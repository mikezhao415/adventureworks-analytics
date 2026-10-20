"""Export validated analytical content at filter-safe grains; never access SQL Server."""
import argparse
from decimal import Decimal, ROUND_HALF_UP, localcontext
import hashlib
import json
from pathlib import Path
import re
import subprocess

import duckdb
import yaml

from src.analytics import ROOT, PROJECT, resolve_snapshot
from src.analytics_validation import reconcile
from src.extract import ValidationError, atomic_json, canonical, digest

HEADER = ('order_count','units_sold','net_line_sales','header_subtotal','tax','freight','total_due')
LINE = ('order_count','units_sold','net_line_sales')
MONEY = set(HEADER)-{'order_count','units_sold'}


def rows(con, sql):
    result = con.execute(sql)
    return [dict(zip([c[0] for c in result.description], row)) for row in result.fetchall()]


def aggregate(items, key, fields):
    grouped = {}
    with localcontext() as context:
        context.prec = 60
        for row in items:
            k = key(row)
            bucket = grouped.setdefault(k,{f:Decimal(0) if f in MONEY else 0 for f in fields})
            for f in fields:
                bucket[f] += row[f]
    return grouped


def aov(row):
    with localcontext() as context:
        context.prec = 60
        return ((row['header_subtotal']/row['order_count']).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP)
                if row['order_count'] else None)


def reconcile_export(con, payload):
    """Regroup exported cells and compare every row of all six existing marts."""
    checks = [
        ('mart_sales_summary','customers',lambda r:1, 'summary_key',HEADER),
        ('mart_sales_monthly','customers',lambda r:r['date'][:7], 'sales_month',HEADER),
        ('mart_sales_customer','customers',lambda r:r['customer_key'], 'customer_key',HEADER),
        ('mart_sales_territory','customers',lambda r:r['territory_key'], 'territory_key',HEADER),
        ('mart_sales_product','products',lambda r:r['product_key'], 'product_key',LINE),
        ('mart_sales_category','categories',lambda r:r['category_key'], 'category_key',LINE),
    ]
    evidence = {}
    for model, section, key, key_name, fields in checks:
        grouped = aggregate(payload[section],key,fields)
        if model == 'mart_sales_summary' and not grouped:
            grouped = {1:{f:Decimal(0) if f in MONEY else 0 for f in fields}}
        actual = rows(con,'select * from '+model)
        wanted = {}
        for row in actual:
            k = str(row[key_name])[:7] if key_name == 'sales_month' else row[key_name]
            wanted[k] = {f:row[f] for f in fields}
            if fields == HEADER:
                wanted[k]['average_order_value'] = row['average_order_value']
        if fields == HEADER:
            for bucket in grouped.values(): bucket['average_order_value'] = aov(bucket)
        if grouped != wanted:
            raise ValidationError('Dashboard export differs from mart: '+model)
        evidence[model] = {'result':'pass','rows':len(actual)}
    return evidence


def make_payload(con):
    customers = rows(con,'''with h as (
      select cast(ordered_at as date)::varchar as date,territory_key,customer_key,
        count(*)::bigint as order_count,sum(subtotal) as header_subtotal,
        sum(tax) as tax,sum(freight) as freight,sum(total_due) as total_due
      from fct_sales_orders where is_sales_eligible group by 1,2,3
    ), l as (
      select cast(o.ordered_at as date)::varchar as date,l.territory_key,l.customer_key,
        sum(l.quantity)::bigint as units_sold,sum(l.net_line_sales) as net_line_sales
      from fct_sales_order_lines l join fct_sales_orders o using(sales_order_id)
      where l.is_sales_eligible group by 1,2,3
    ) select h.*,l.units_sold,l.net_line_sales from h join l using(date,territory_key,customer_key)
      order by date,territory_key,customer_key''')
    payload = {'customers':customers}
    for section, key in (('products','product_key'),('categories','category_key')):
        payload[section] = rows(con,f'''select cast(o.ordered_at as date)::varchar as date,
            l.territory_key,p.{key},count(distinct l.sales_order_id)::bigint as order_count,
            sum(l.quantity)::bigint as units_sold,sum(l.net_line_sales) as net_line_sales
            from fct_sales_order_lines l join fct_sales_orders o using(sales_order_id)
            join dim_product p on p.product_key=l.product_key
            where l.is_sales_eligible group by 1,2,3 order by 1,2,3''')
    payload['dimensions'] = {
        'territories': rows(con,'select territory_key as key,territory_name as name from dim_territory order by 1'),
        'categories': rows(con,'select category_key as key,category_name as name from dim_product_category order by 1'),
        'products': rows(con,'select product_key as key,product_name as name,category_key from dim_product order by 1'),
    }
    dates = [r['date'] for r in customers]
    payload['period'] = {'start':min(dates) if dates else None,'end':max(dates) if dates else None}
    return payload


def export_dashboard(analytics_root, snapshot_root, destination):
    root, destination = Path(analytics_root).resolve(),Path(destination).resolve()
    pointer = json.loads((root/'current.json').read_text(encoding='utf-8'))
    if not re.fullmatch(r'[A-Za-z0-9_-]+',pointer['run_id']):
        raise ValidationError('Unsafe analytical run ID')
    run = root/pointer['run_id']
    for name, field in (('evidence.json','evidence_sha256'),('analytics.duckdb','database_sha256')):
        if digest(run/name) != pointer[field]:
            raise ValidationError('Analytical artifact checksum differs: '+name)
    evidence = json.loads((run/'evidence.json').read_text(encoding='utf-8'))
    snapshot, source_pointer = resolve_snapshot(snapshot_root)
    if evidence['result'] != 'pass' or evidence['snapshot'] != source_pointer:
        raise ValidationError('Analytical snapshot provenance differs')
    mode = evidence.get('validation_mode','real_adventureworks')
    # Real-derived exports must stay in ignored output, never the tracked demo.
    if mode != 'offline_fixture' and not destination.is_relative_to(ROOT/'output'):
        raise ValidationError('Real dashboard data must remain under ignored output/')
    con = duckdb.connect(str(run/'analytics.duckdb'),read_only=True)
    try:
        specs = yaml.safe_load((PROJECT/'models'/'schema.yml').read_text())['models']
        result = reconcile(con,snapshot,specs)
        if result['models'] != evidence['models']:
            raise ValidationError('Analytical model content differs from evidence')
        payload = make_payload(con)
        controls = reconcile_export(con,payload)
    finally:
        con.close()
    if digest(run/'analytics.duckdb') != pointer['database_sha256']:
        raise ValidationError('Analytical artifact changed during export')
    manifest = json.loads((snapshot/'manifest.json').read_text(encoding='utf-8'))
    document = {'version':1,'provenance':{'mode':mode,
        'snapshot_id':source_pointer['snapshot_id'] if mode!='offline_fixture' else 'dashboard-fixture-v1',
        'input_fingerprint':source_pointer['input_fingerprint'],
        'source_extracted_at':manifest['source']['started_utc'],
        'analytics_revision':evidence['code_revision'],
        'export_revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'working_tree_dirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip()),
        'reconciliation':controls},'data':payload,
        'content_sha256':hashlib.sha256(canonical(payload).encode()).hexdigest()}
    destination.parent.mkdir(parents=True,exist_ok=True)
    atomic_json(destination,document)
    return document


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--analytics-root',type=Path,default=ROOT/'output'/'analytics')
    parser.add_argument('--snapshot-root',type=Path,default=ROOT/'output'/'adventureworks')
    parser.add_argument('--destination',type=Path,default=ROOT/'output'/'dashboard'/'data.json')
    args = parser.parse_args()
    result = export_dashboard(args.analytics_root,args.snapshot_root,args.destination)
    print('PASS: six dashboard mart controls; mode='+result['provenance']['mode']+'; '+str(args.destination))


if __name__ == '__main__': main()
