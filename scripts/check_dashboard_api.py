"""Local/manual dashboard HTTP reconciliation against read-only validated facts.

Start apps/web with AW_DASHBOARD_DATA pointing at the exported real data first.
"""
import argparse
from decimal import Decimal, ROUND_HALF_UP
import json
import platform
import subprocess
from pathlib import Path
import sys
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import duckdb
from src.extract import atomic_json,digest,ValidationError


def check(base_url, analytics_root):
    pointer=json.loads((analytics_root/'current.json').read_text())
    run=analytics_root/pointer['run_id']
    if digest(run/'analytics.duckdb')!=pointer['database_sha256']:
        raise ValidationError('Analytical database checksum differs')
    con=duckdb.connect(str(run/'analytics.duckdb'),read_only=True)
    results=[]
    try:
        for filters in ({},{'start':'2012-01-01','end':'2012-12-31','territory':'1','category':'1'},
                        {'start':'2011-05-31','end':'2011-05-31'},
                        {'start':'2030-01-01','end':'2030-01-01'},
                        {'territory':'1,2','category':'1,2'},
                        {'utm_source':'chatgpt.com','territory':'1,2','category':'1,2'}):
            with urllib.request.urlopen(base_url+'/api/dashboard?'+urllib.parse.urlencode(filters)) as response:
                actual=json.load(response)
            if actual['provenance']['snapshot_id']!=pointer['snapshot_id']:
                raise ValidationError('HTTP snapshot identity differs')
            applied=actual['filters']
            where='o.is_sales_eligible and cast(o.ordered_at as date) between ? and ?'
            values=[applied['start'],applied['end']]
            if applied['territory']!='all':
                keys=[int(key) for key in applied['territory'].split(',')]
                where+=' and o.territory_key in ('+','.join('?' for _ in keys)+')'
                values.extend(keys)
            groups=[('summary',None,None),('monthly',"strftime(o.ordered_at,'%Y-%m')",'month'),
                    ('customers','o.customer_key','key'),('territories','o.territory_key','key')]
            for section,group,key in groups:
                prefix=(group+' as group_key,') if group else ''
                by=' group by 1' if group else ''
                headers=con.execute(f'select {prefix}count(*),sum(o.subtotal) from fct_sales_orders o where {where}{by}',values).fetchall()
                lines=con.execute(f'''select {prefix}sum(l.quantity),sum(l.net_line_sales)
                    from fct_sales_order_lines l join fct_sales_orders o using(sales_order_id)
                    where {where}{by}''',values).fetchall()
                line_map={str(r[0]) if group else 'summary':r[1:] if group else r for r in lines}
                wanted={}
                for r in headers:
                    k=str(r[0]) if group else 'summary';orders,subtotal=r[1:] if group else r
                    units,sales=line_map[k]
                    wanted[k]={'order_count':orders,'units_sold':units or 0,'net_line_sales':sales or Decimal(0),
                               'header_subtotal':subtotal or Decimal(0),
                               'average_order_value':(subtotal/orders).quantize(Decimal('.0001'),rounding=ROUND_HALF_UP) if orders else None}
                shown={'summary':actual['summary']} if not group else {str(r[key]):r for r in actual[section]}
                if set(wanted)!=set(shown):raise ValidationError('HTTP key-set differs: '+section)
                for k,controls in wanted.items():
                    for field,value in controls.items():
                        observed=shown[k][field]
                        if isinstance(value,Decimal): observed=Decimal(observed)
                        if observed!=value:raise ValidationError('HTTP metric differs: '+section+'.'+field)
            for section,group in (('products','p.product_key'),('categories','p.category_key')):
                clause=where;params=list(values)
                if applied['category']!='all':
                    keys=[int(key) for key in applied['category'].split(',')]
                    clause+=' and p.category_key in ('+','.join('?' for _ in keys)+')'
                    params.extend(keys)
                expected=con.execute(f'''select {group},count(distinct l.sales_order_id),sum(l.quantity),sum(l.net_line_sales)
                    from fct_sales_order_lines l join fct_sales_orders o using(sales_order_id)
                    join dim_product p on p.product_key=l.product_key where {clause} group by 1''',params).fetchall()
                observed={int(r['key']):(r['order_count'],r['units_sold'],Decimal(r['net_line_sales'])) for r in actual[section]}
                if {r[0]:r[1:] for r in expected}!=observed:raise ValidationError('HTTP grouped line metrics differ: '+section)
            results.append({'filters':filters,'result':'pass','controls':'all six dashboard views',
                            'summary':actual['summary']})
    finally:con.close()
    atomic_json(ROOT/'output'/'dashboard'/'http-validation.json',{'mode':'real_adventureworks','result':'pass',
        'snapshot_id':pointer['snapshot_id'],'scenarios':results,
        'code_revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'working_tree_dirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip()),
        'environment':{'python':platform.python_version(),'duckdb':duckdb.__version__},
        'limitations':['Local HTTP check against existing analytical artifact; no live SQL Server.']})
    print('PASS: six HTTP filter scenarios independently reconciled across all six views')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',default='http://127.0.0.1:3200')
    parser.add_argument('--analytics-root',type=Path,default=ROOT/'output'/'analytics')
    args=parser.parse_args();check(args.base_url,args.analytics_root)
