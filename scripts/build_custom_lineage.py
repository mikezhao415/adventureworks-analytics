"""Manual custom-lineage candidates. Never approves, stages or publishes metadata.

Verifies the complete manifest digest, source revision and analytical identity.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import uuid

from scripts import lineage_inputs as inputs

ROOT = inputs.ROOT
REFERENCE = ROOT / 'docs/lineage/sales-lineage.json'
POLICY = inputs.POLICY
CONTEXT = ['SQL Server read-only extraction', 'validated Parquet snapshots', 'declared raw DuckDB tables']
SCOPE = 'Ancestors of mart_sales_summary only; test definitions are not execution results.'
GENERIC = {'grain': 'Grain uniqueness', 'not_null': 'Not-null constraint',
           'relationships': 'Relationship constraint', 'unique': 'Unique constraint'}
SINGULAR = {
    'aw_dimension_grain': 'Dimension grain checks',
    'aw_dimension_relationships': 'Dimension relationship checks',
    'aw_fact_grain': 'Fact grain checks',
    'aw_financial_reconciliation': 'Financial reconciliation checks',
    'aw_mart_reconciliation': 'Sales mart reconciliation checks',
    'aw_row_counts': 'Row-count reconciliation checks',
}


def require(value, message):
    inputs.require(value, message)


def text(value, limit=20000):
    require(isinstance(value, str) and len(value) <= limit, 'Invalid public text')
    inputs.scan(value)
    require(not re.search(r'(?i)\b(select|insert|delete|drop|update)\s+\S+|\{\{|\{%|<[^>]+>', value),
            'SQL/template/HTML is not public metadata')
    return value


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', value), 'Invalid identifier')
    return value


def semantic(doc):
    # Timestamps are operational, not a substantive metadata change.
    value = json.loads(json.dumps(doc))
    value.pop('content_sha256', None)
    value['provenance'].pop('generated_at', None)
    return inputs.digest(inputs.canonical(value))


def project(manifest, provenance):
    graph = inputs.lineage(manifest)
    expected = inputs.read_json(REFERENCE)
    require(graph == expected, 'Unexpected topology or manifest provenance')
    selected = {n['id'] for n in graph['nodes']}
    nodes = []
    for item in graph['nodes']:
        node = (manifest['nodes'] if item['kind'] == 'model' else manifest['sources'])[item['id']]
        tests = []
        for key, test in sorted(manifest['nodes'].items()):
            if test.get('resource_type') != 'test' or item['id'] not in test.get('depends_on', {}).get('nodes', []):
                continue
            meta = test.get('test_metadata')
            arguments = {}
            if meta:
                name = meta['name']
                require(name in GENERIC, 'Unreviewed test definition')
                for k, v in meta.get('kwargs', {}).items():
                    require(k in {'model', 'to', 'column_name', 'field', 'keys'}, 'Unreviewed test argument')
                    # dbt's model/to arguments are executable Jinja. Publish only IDs
                    # already declared as test dependencies within this focused graph.
                    if k in {'model', 'to'}:
                        continue
                    arguments[k] = [identifier(x) for x in v] if k == 'keys' else identifier(v)
                definition = GENERIC[name]
            else:
                require(test['name'] in SINGULAR, 'Unreviewed custom test')
                definition = SINGULAR[test['name']]
            tests.append({'id': text(key), 'definition': definition,
                          'column': identifier(test['column_name']) if test.get('column_name') else None,
                          'arguments': arguments,
                          'related_nodes': sorted(set(test['depends_on']['nodes']) & selected),
                          'scope': 'May also check resources outside this focused graph.' if
                          set(test['depends_on']['nodes']) - selected else 'Within this focused graph.'})
        columns = [{'name': identifier(k), 'type': text(v.get('data_type') or 'Not declared', 100),
                    'description': text(v.get('description') or '')}
                   for k, v in sorted(node.get('columns', {}).items())]
        materialization = node.get('config', {}).get('materialized') if item['kind'] == 'model' else None
        require(materialization in {None, 'view', 'table', 'incremental', 'ephemeral'}, 'Unexpected materialization')
        nodes.append({**item, 'description': text(node.get('description') or ''),
                      'materialization': materialization, 'columns': columns, 'tests': tests})
    doc = {'schema_version': 1, 'target': graph['target'], 'scope': SCOPE,
           'context': CONTEXT, 'provenance': provenance, 'nodes': nodes, 'edges': graph['edges']}
    doc['content_sha256'] = semantic(doc)
    return doc


def audit(doc):
    """Strict output contract, independent of full-manifest sanitation."""
    def keys(obj, names):
        require(isinstance(obj, dict) and set(obj) == set(names.split()), 'Unexpected metadata fields')
    keys(doc, 'schema_version target scope context provenance nodes edges content_sha256')
    require(doc['schema_version'] == 1 and doc['scope'] == SCOPE and doc['context'] == CONTEXT, 'Invalid contract')
    p = doc['provenance']
    keys(p, 'generated_at source_revision dbt_source_sha256 manifest_sha256 database_sha256 evidence_sha256 snapshot_id input_fingerprint versions')
    require(re.fullmatch(r'[0-9a-f]{40}', p['source_revision']), 'Invalid revision')
    for field in ['dbt_source_sha256', 'manifest_sha256', 'database_sha256', 'evidence_sha256', 'input_fingerprint']:
        require(re.fullmatch(r'[0-9a-f]{64}', p[field]), 'Invalid provenance digest')
    require(p['versions'] == inputs.VERSIONS, 'Unexpected dependency versions')
    require(dt.datetime.fromisoformat(p['generated_at']).utcoffset() == dt.timedelta(0), 'Use UTC generation time')
    text(p['snapshot_id'])
    ref = inputs.read_json(REFERENCE)
    require(doc['target'] == ref['target'] and doc['edges'] == ref['edges'], 'Unexpected topology')
    require([(n['id'], n['name'], n['kind']) for n in doc['nodes']] ==
            [(n['id'], n['name'], n['kind']) for n in ref['nodes']], 'Unexpected node inventory')
    ids = {n['id'] for n in doc['nodes']}
    for n in doc['nodes']:
        keys(n, 'id name kind description materialization columns tests')
        text(n['description'])
        require(n['materialization'] in {'table', 'view', 'incremental', 'ephemeral'} if n['kind'] == 'model'
                else n['materialization'] is None, 'Invalid materialization')
        require(len({c['name'] for c in n['columns']}) == len(n['columns']), 'Duplicate column')
        for c in n['columns']:
            keys(c, 'name type description'); identifier(c['name']); text(c['type'], 100); text(c['description'])
        require(len({t['id'] for t in n['tests']}) == len(n['tests']), 'Duplicate test')
        for t in n['tests']:
            keys(t, 'id definition column arguments related_nodes scope')
            require(t['id'].startswith('test.adventureworks.'), 'Invalid test identity')
            text(t['id']); text(t['definition']); text(t['scope'])
            require(t['definition'] in set(GENERIC.values()) | set(SINGULAR.values()), 'Invalid test definition')
            if t['column'] is not None: identifier(t['column'])
            require(set(t['arguments']) <= {'column_name', 'field', 'keys'}, 'Unexpected argument')
            for k, v in t['arguments'].items():
                if k == 'keys':
                    require(isinstance(v, list), 'Invalid key arguments')
                    for x in v: identifier(x)
                else: identifier(v)
            require(isinstance(t['related_nodes'], list) and len(set(t['related_nodes'])) == len(t['related_nodes'])
                    and set(t['related_nodes']) <= ids and n['id'] in t['related_nodes'], 'Invalid test scope')
    require(semantic(doc) == doc['content_sha256'], 'Content digest mismatch')
    inputs.scan(doc)
    return doc


def approve_bytes(raw, pin):
    """Verify an independently supplied approval record; does not create approval."""
    require(set(pin) == {'schema_version', 'publication_approved', 'sha256', 'content_sha256', 'review_reference'}, 'Invalid approval fields')
    require(pin['schema_version'] == 1 and pin['publication_approved'] is True and
            isinstance(pin['review_reference'], str) and pin['review_reference'].strip(), 'No explicit approval')
    def unique(pairs):
        result = {}
        for k, v in pairs:
            require(k not in result, 'Duplicate JSON key')
            result[k] = v
        return result
    doc = audit(json.loads(raw, object_pairs_hook=unique))
    require(raw == inputs.canonical(doc) + b'\n', 'Noncanonical artifact bytes')
    require(inputs.digest(raw) == pin['sha256'] and doc['content_sha256'] == pin['content_sha256'], 'Unapproved bytes')
    return doc


def generate(manifest_path, analytics_root, revision, output_root):
    policy = inputs.read_json(POLICY)
    db, pointer, identity = inputs.verify_input(analytics_root, revision, policy)
    manifest = inputs.read_json(manifest_path)
    require(inputs.digest(inputs.canonical(manifest)) == policy['manifest_semantic_sha256'], 'Unreviewed manifest')
    snapshot = analytics_root.parent / 'adventureworks' / identity['snapshot']['snapshot_id'] / 'manifest.json'
    require(inputs.digest(snapshot.read_bytes()) == identity['snapshot']['manifest_sha256'], 'Snapshot manifest changed')
    provenance = {'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'source_revision': revision,
                  'dbt_source_sha256': policy['dbt_source_sha256'], 'manifest_sha256': policy['manifest_semantic_sha256'],
                  'database_sha256': identity['database_sha256'], 'evidence_sha256': identity['evidence_sha256'],
                  'snapshot_id': identity['snapshot']['snapshot_id'],
                  'input_fingerprint': identity['snapshot']['input_fingerprint'], 'versions': inputs.VERSIONS}
    doc = audit(project(manifest, provenance))
    raw = inputs.canonical(doc) + b'\n'
    require(output_root.resolve().is_relative_to((ROOT/'output').resolve()), 'Candidate must remain ignored')
    output_root.mkdir(parents=True, exist_ok=True)
    require(not output_root.is_symlink(), 'Symlink output')
    with tempfile.TemporaryDirectory(dir=output_root) as temp:
        stage = Path(temp)
        (stage/'lineage.json').write_bytes(raw)
        review = {'publication_approved': False, 'artifact_sha256': inputs.digest(raw),
                  'content_sha256': doc['content_sha256'], 'bytes': len(raw), 'nodes': 8, 'edges': 9}
        (stage/'review.json').write_bytes(inputs.canonical(review)+b'\n')
        require((analytics_root/'current.json').read_bytes() == pointer and
                inputs.digest(db.read_bytes()) == identity['database_sha256'], 'Analytical input changed')
        run_id = uuid.uuid4().hex
        final = output_root/run_id
        shutil.copytree(stage, final)
        pointer_temp = output_root/(run_id+'.tmp')
        try:
            pointer_temp.write_bytes(inputs.canonical({'run_id': run_id, 'sha256': inputs.digest(raw)})+b'\n')
            os.replace(pointer_temp, output_root/'current.json')
        except BaseException:
            pointer_temp.unlink(missing_ok=True)
            raise
    return final


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--analytics-root', type=Path, required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--output-root', type=Path, default=ROOT/'output/custom-lineage-review/candidates')
    args = parser.parse_args()
    print(generate(args.manifest, args.analytics_root, args.revision, args.output_root))
