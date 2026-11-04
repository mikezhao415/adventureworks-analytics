"""Read-only input identity and safety checks for custom lineage metadata."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / 'docs/lineage/metadata-policy.json'
VERSIONS = {'dbt-core': '1.12.5', 'dbt-duckdb': '1.11.0', 'duckdb': '1.5.6'}
TARGET = 'model.adventureworks.mart_sales_summary'

UNSAFE = re.compile(
    r'(?i)(?:(?<![a-z0-9_])[a-z]:[\\/]|file://|/(?:home|Users|tmp|private|etc)/|\\\\[^\\\s]+\\'
    r'|-----BEGIN [A-Z ]*PRIVATE KEY|(?:gh[pousr]_|github_pat_)[a-z0-9_]+'
    r'|AKIA[0-9A-Z]{16}|(?:password|api[_-]?key|access[_-]?token|secret)\s*[=:]\s*[\"\']?[^\s\"\'{}]+)')


class AuditError(ValueError):
    """Candidate cannot be accepted; no known-good pointer is changed."""


def require(condition, message):
    if not condition:
        raise AuditError(message)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON key')
            result[key] = value
        return result
    try:
        return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique)
    except (OSError, ValueError) as error:
        raise AuditError('Missing or malformed JSON: ' + path.name) from error


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()


def source_fingerprint(revision):
    """Git blobs avoid platform checkout newline differences."""
    entries = git('ls-tree', '-r', revision, '--', 'dbt/adventureworks').splitlines()
    require(entries, 'Missing real-source dbt project')
    return digest('\n'.join(entries).encode())


def scan(value):
    if isinstance(value, dict):
        for key, item in value.items():
            scan(key)
            scan(item)
    elif isinstance(value, list):
        for item in value:
            scan(item)
    elif isinstance(value, str):
        require(not UNSAFE.search(value), 'Unsafe path or credential-like content')
        require(not re.search(r'(?i)</script|<iframe|javascript:|<script', value),
                'Unsafe embedded HTML')


def lineage(manifest):
    nodes = {k: v for k, v in manifest['nodes'].items() if v['resource_type'] == 'model'}
    sources = manifest['sources']
    selected, edges, active = set(), set(), set()

    def visit(key):
        require(key in nodes or key in sources, 'Unknown transformation node')
        require(key not in active, 'Cyclic transformation dependency')
        if key in selected:
            return
        active.add(key)
        selected.add(key)
        if key in nodes:
            for parent in nodes[key]['depends_on']['nodes']:
                edges.add((parent, key))
                visit(parent)
        active.remove(key)

    visit(TARGET)
    return {'schema_version': 1, 'target': TARGET,
            'manifest_semantic_sha256': digest(canonical(manifest)),
            'edge_semantics': 'source/model depends_on.nodes only; no relationship-test edges',
            'outside_dbt_context': ['SQL Server read-only extraction', 'validated Parquet snapshots',
                                    'declared raw DuckDB tables'],
            'nodes': [{'id': key, 'name': (nodes.get(key) or sources[key])['name'],
                       'kind': 'model' if key in nodes else 'source'} for key in sorted(selected)],
            'edges': [{'source': a, 'target': b} for a, b in sorted(edges)]}


def verify_input(root, revision, policy):
    require(re.fullmatch(r'[0-9a-f]{40}', revision), 'Use a full source commit SHA')
    require(git('rev-parse', 'HEAD') == revision, 'Selected revision is not HEAD')
    require(not git('status', '--porcelain', '--', 'dbt/adventureworks'), 'Dirty dbt source')
    fingerprint = source_fingerprint(revision)
    require(fingerprint == policy['dbt_source_sha256'], 'Unreviewed dbt source')
    pointer_bytes = (root/'current.json').read_bytes()
    pointer = read_json(root/'current.json')
    require(re.fullmatch(r'[A-Za-z0-9_-]+', pointer.get('run_id', '')), 'Unsafe run identity')
    run = root/pointer['run_id']
    require(not run.is_symlink(), 'Symlink analytical run')
    db, evidence_path = run/'analytics.duckdb', run/'evidence.json'
    require(digest(db.read_bytes()) == pointer['database_sha256'], 'Database checksum mismatch')
    require(digest(evidence_path.read_bytes()) == pointer['evidence_sha256'], 'Evidence checksum mismatch')
    evidence = read_json(evidence_path)
    require(evidence.get('mode') == 'adventureworks_analytics' and evidence.get('result') == 'pass',
            'Analytical evidence is not passing real-source analytics')
    require(not evidence.get('working_tree_dirty'), 'Dirty analytical source evidence')
    require(evidence.get('dbt_results') == {'pass': 97, 'success': 23}, 'Incomplete historical dbt evidence')
    require(all(evidence.get('environment', {}).get(k) == v for k, v in VERSIONS.items()),
            'Historical dependency versions differ')
    require(source_fingerprint(evidence['code_revision']) == fingerprint, 'Stale analytical model source')
    snapshot = evidence['snapshot']
    require(snapshot['snapshot_id'] == pointer['snapshot_id'], 'Snapshot identity mismatch')
    identity = {'database_sha256': pointer['database_sha256'], 'evidence_sha256': pointer['evidence_sha256'],
                'snapshot': snapshot, 'analytics_revision': evidence['code_revision']}
    require(digest(canonical(identity)) == policy['analytical_identity_sha256'], 'Unreviewed analytical identity')
    return db, pointer_bytes, identity
