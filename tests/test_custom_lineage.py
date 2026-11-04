"""Offline custom artifact contracts; no publication or original database writes."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import build_custom_lineage as custom


def fixture():
    graph = custom.inputs.read_json(custom.REFERENCE)
    manifest = {'nodes': {}, 'sources': {}}
    for n in graph['nodes']:
        value = {'unique_id': n['id'], 'name': n['name'], 'resource_type': n['kind'],
                 'description': 'Fictional contract fixture',
                 'config': {'materialized': 'table'},
                 'columns': {'fixture_key': {'data_type': 'integer', 'description': ''}},
                 'depends_on': {'nodes': [e['source'] for e in graph['edges'] if e['target'] == n['id']]}}
        manifest['nodes' if n['kind'] == 'model' else 'sources'][n['id']] = value
    target = graph['target']
    manifest['nodes']['test.adventureworks.fixture'] = {
        'resource_type': 'test', 'column_name': 'fixture_key',
        'test_metadata': {'name': 'not_null', 'kwargs': {'model': '{{ ref("fixture") }}'}},
        'depends_on': {'nodes': [target]}, 'compiled_code': 'NEVER_PUBLISH_TEST_SQL'}
    provenance = {'generated_at': '2026-01-01T00:00:00+00:00', 'source_revision': 'a'*40,
                  **{k: 'b'*64 for k in ['dbt_source_sha256','manifest_sha256','database_sha256','evidence_sha256','input_fingerprint']},
                  'snapshot_id': 'fictional-fixture', 'versions': custom.inputs.VERSIONS}
    expected = custom.inputs.lineage(manifest)
    with patch.object(custom.inputs, 'read_json', return_value=expected):
        doc = custom.project(manifest, provenance)
    return manifest, doc


class CustomLineageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Temporary generation tests must also work in a fresh checkout.
        (custom.ROOT / 'output').mkdir(exist_ok=True)

    def test_input_json_and_safety_checks_reject_invalid_content(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'manifest.json'
            for raw in ['{', '{"key":1,"key":2}']:
                path.write_text(raw)
                with self.assertRaises(custom.inputs.AuditError):
                    custom.inputs.read_json(path)
            path.unlink()
            with self.assertRaises(custom.inputs.AuditError):
                custom.inputs.read_json(path)
        for unsafe in ['C:/Users/private/key', '/home/private/key', 'file:///tmp/key',
                       'password=fictional', 'ghp_' + 'x'*36, '<script>alert(1)</script>']:
            with self.subTest(unsafe=unsafe), self.assertRaises(custom.inputs.AuditError):
                custom.inputs.scan({'nested': [unsafe]})

    def test_unreviewed_manifest_fails_before_projection_or_output(self):
        manifest, _ = fixture()
        policy = {'manifest_semantic_sha256': custom.inputs.digest(custom.inputs.canonical(manifest))}
        changed = deepcopy(manifest)
        changed['metadata'] = {'unreviewed': True}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with patch.object(custom.inputs, 'verify_input', return_value=(root/'db', b'pointer', {})), \
                 patch.object(custom.inputs, 'read_json', side_effect=[policy, changed]), \
                 patch.object(custom, 'project') as project:
                with self.assertRaisesRegex(custom.inputs.AuditError, 'Unreviewed manifest'):
                    custom.generate(root/'manifest', root, 'a'*40, root/'candidate')
                project.assert_not_called()
            self.assertFalse((root/'candidate').exists())

    def test_fixture_contract_and_projection(self):
        _, doc = fixture()
        self.assertIs(custom.audit(doc), doc)
        self.assertEqual((len(doc['nodes']),len(doc['edges'])), (8,9))
        self.assertNotIn('NEVER_PUBLISH', json.dumps(doc))
        self.assertNotIn('{{', json.dumps(doc))

    def test_approval_requires_explicit_exact_pins(self):
        _, doc = fixture(); raw = custom.inputs.canonical(doc)+b'\n'
        pin = {'schema_version':1, 'publication_approved':True, 'sha256':custom.inputs.digest(raw),
               'content_sha256':doc['content_sha256'], 'review_reference':'Fictional test only'}
        self.assertEqual(custom.approve_bytes(raw,pin),doc)
        for changes in [{'publication_approved':False},{'sha256':'0'*64},{'content_sha256':'0'*64},{'review_reference':''}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError): custom.approve_bytes(raw,{**pin,**changes})

    def test_unknown_fields_sql_html_and_paths_fail(self):
        _, original = fixture()
        for field, value in [('raw_code','select 1'), ('environment',{}), ('rows',[])]:
            doc=deepcopy(original); doc[field]=value
            with self.subTest(field=field), self.assertRaises(ValueError): custom.audit(doc)
        for content in ['/Users/private/secret', 'select * from private', '<script>alert(1)</script>', '{{ secret }}']:
            doc=deepcopy(original); doc['nodes'][0]['description']=content
            with self.subTest(content=content), self.assertRaises(ValueError): custom.audit(doc)

    def test_cycle_unknown_parent_and_duplicates_fail(self):
        m,_=fixture()
        for parent in ['model.adventureworks.unknown',custom.inputs.TARGET]:
            changed=deepcopy(m)
            changed['nodes']['model.adventureworks.stg_sales_order_header']['depends_on']['nodes'].append(parent)
            with self.subTest(parent=parent), self.assertRaises(ValueError): custom.project(changed,{})
        _,doc=fixture(); doc['nodes'].append(doc['nodes'][0])
        with self.assertRaises(ValueError): custom.audit(doc)

    def test_test_dependencies_never_create_edges(self):
        m,doc=fixture()
        m['nodes']['test.adventureworks.fixture']['depends_on']['nodes'].append('model.adventureworks.dim_date')
        graph=custom.inputs.lineage(m)
        self.assertEqual(graph['edges'],doc['edges'])

    def test_digest_ignores_generation_time_only(self):
        _,doc=fixture(); altered=deepcopy(doc)
        altered['provenance']['generated_at']='2026-02-01T00:00:00+00:00'
        self.assertEqual(custom.semantic(doc),custom.semantic(altered))
        altered['nodes'][0]['description']='Changed'
        self.assertNotEqual(custom.semantic(doc),custom.semantic(altered))

    def test_duplicate_json_and_changed_bytes_rejected(self):
        _,doc=fixture(); raw=custom.inputs.canonical(doc)+b'\n'
        pin={'schema_version':1,'publication_approved':True,'sha256':custom.inputs.digest(raw),
             'content_sha256':doc['content_sha256'],'review_reference':'test'}
        for altered in [raw+b' ', raw.replace(b'"schema_version":1',b'"schema_version":1,"schema_version":1')]:
            with self.assertRaises(ValueError): custom.approve_bytes(altered,{**pin,'sha256':custom.inputs.digest(altered)})

    def test_malformed_and_unknown_test_metadata_rejected(self):
        m,_=fixture()
        m['nodes']['test.adventureworks.fixture']['test_metadata']['kwargs']['secret']='hidden'
        with patch.object(custom.inputs,'read_json',return_value=custom.inputs.lineage(m)):
            with self.assertRaises(ValueError): custom.project(m,{})

    def test_generation_failure_preserves_pointer(self):
        with tempfile.TemporaryDirectory(dir=custom.ROOT/'output') as temp:
            root=Path(temp); (root/'current.json').write_bytes(b'previous')
            with patch.object(custom.inputs,'verify_input',side_effect=ValueError('bad identity')):
                with self.assertRaises(ValueError): custom.generate(root/'missing',root,'a'*40,root)
            self.assertEqual((root/'current.json').read_bytes(),b'previous')

    def test_atomic_pointer_failure_preserves_previous_candidate(self):
        manifest, doc = fixture()
        with tempfile.TemporaryDirectory(dir=custom.ROOT/'output') as temp:
            root=Path(temp); analytics=root/'analytics'; analytics.mkdir()
            (analytics/'current.json').write_bytes(b'previous analytical pointer')
            db=analytics/'analytics.duckdb'; db.write_bytes(b'fictional database bytes')
            snap=root/'adventureworks/fixture'; snap.mkdir(parents=True)
            (snap/'manifest.json').write_bytes(b'fictional snapshot manifest')
            output=root/'candidates'; output.mkdir(); (output/'current.json').write_bytes(b'previous valid candidate')
            identity={'database_sha256':custom.inputs.digest(db.read_bytes()),'evidence_sha256':'e'*64,
                      'snapshot':{'snapshot_id':'fixture','manifest_sha256':custom.inputs.digest((snap/'manifest.json').read_bytes()),'input_fingerprint':'f'*64}}
            policy={'manifest_semantic_sha256':custom.inputs.digest(custom.inputs.canonical(manifest)), 'dbt_source_sha256':'a'*64}
            def read(path):
                if path==custom.POLICY: return policy
                return manifest
            with patch.object(custom.inputs,'verify_input',return_value=(db,(analytics/'current.json').read_bytes(),identity)), \
                 patch.object(custom.inputs,'read_json',side_effect=read), \
                 patch.object(custom,'project',return_value=doc), patch.object(custom,'audit',return_value=doc), \
                 patch.object(custom.os,'replace',side_effect=OSError('simulated interruption')):
                with self.assertRaises(OSError): custom.generate(root/'manifest',analytics,'a'*40,output)
            self.assertEqual((output/'current.json').read_bytes(),b'previous valid candidate')
            self.assertEqual(list(output.glob('*.tmp')),[])


    def test_analytical_checksums_source_and_snapshot_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            run = root/'run-1'
            run.mkdir()
            (run/'analytics.duckdb').write_bytes(b'offline-test-only')
            evidence = {'mode': 'adventureworks_analytics', 'result': 'pass',
                        'working_tree_dirty': False, 'dbt_results': {'pass': 97, 'success': 23},
                        'code_revision': 'b'*40, 'snapshot': {'snapshot_id': 'snapshot-1'},
                        'environment': custom.inputs.VERSIONS}
            (run/'evidence.json').write_text(json.dumps(evidence))
            pointer = {'run_id': 'run-1', 'snapshot_id': 'snapshot-1',
                       'database_sha256': custom.inputs.digest((run/'analytics.duckdb').read_bytes()),
                       'evidence_sha256': custom.inputs.digest((run/'evidence.json').read_bytes())}
            identity = {'database_sha256': pointer['database_sha256'],
                        'evidence_sha256': pointer['evidence_sha256'],
                        'snapshot': evidence['snapshot'], 'analytics_revision': 'b'*40}
            policy = {'dbt_source_sha256': 'fingerprint',
                      'analytical_identity_sha256': custom.inputs.digest(custom.inputs.canonical(identity))}
            (root/'current.json').write_text(json.dumps(pointer))
            with patch.object(custom.inputs, 'git', side_effect=lambda *args: 'a'*40 if args[0] == 'rev-parse' else ''), \
                 patch.object(custom.inputs, 'source_fingerprint', return_value='fingerprint'):
                custom.inputs.verify_input(root, 'a'*40, policy)
                for field in ['database_sha256', 'evidence_sha256', 'snapshot_id', 'run_id']:
                    invalid = dict(pointer, **{field: '../escape' if field == 'run_id' else 'wrong'})
                    (root/'current.json').write_text(json.dumps(invalid))
                    with self.subTest(field=field), self.assertRaises(custom.inputs.AuditError):
                        custom.inputs.verify_input(root, 'a'*40, policy)
                (root/'current.json').write_text(json.dumps(pointer))
                with patch.object(custom.inputs, 'source_fingerprint', side_effect=['fingerprint', 'stale']):
                    with self.assertRaisesRegex(custom.inputs.AuditError, 'Stale'):
                        custom.inputs.verify_input(root, 'a'*40, policy)

if __name__ == '__main__': unittest.main()
