"""Run the offline regression suite and retain machine-readable test evidence.

Run: python -m src.quality_check
No SQL Server, credentials or private datasets are used.
"""
import argparse
import importlib.metadata
import os
from pathlib import Path
import platform
import subprocess
import sys
import unittest

from src.extract import atomic_json, digest

ROOT = Path(__file__).resolve().parents[1]


class EvidenceResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.outcomes = []

    def addSuccess(self, test):
        super().addSuccess(test)
        self.outcomes.append({'test': test.id(), 'result': 'pass'})

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.outcomes.append({'test': test.id(), 'result': 'fail', 'error_type': err[0].__name__})

    def addError(self, test, err):
        super().addError(test, err)
        self.outcomes.append({'test': test.id(), 'result': 'error', 'error_type': err[0].__name__})

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.outcomes.append({'test': test.id(), 'result': 'skip', 'reason': reason})

    def addSubTest(self, test, subtest, err):
        super().addSubTest(test, subtest, err)
        self.outcomes.append({'test': subtest.id(), 'result': 'fail' if err else 'pass',
                              'error_type': err[0].__name__ if err else None})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence-root', type=Path, default=ROOT/'output'/'quality')
    args = parser.parse_args()
    root = args.evidence_root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    # Remove previous success evidence before attempting a new suite.
    for name in ('tests.json', 'offline-analytics.json', 'offline-negative.json'):
        (root/name).unlink(missing_ok=True)
    os.environ['AW_QUALITY_EVIDENCE'] = str(root)
    suite = unittest.defaultTestLoader.discover(str(ROOT/'tests'))
    result = unittest.TextTestRunner(verbosity=2, resultclass=EvidenceResult).run(suite)
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    atomic_json(root/'tests.json', {
        'mode': 'offline_fixture', 'result': 'pass' if result.wasSuccessful() else 'fail',
        'execution_context': 'github_actions' if os.environ.get('GITHUB_ACTIONS') == 'true' else 'local',
        'code_revision': revision, 'working_tree_dirty': dirty,
        'requirements_lock_sha256': digest(ROOT/'requirements.lock'),
        'environment': {'python': platform.python_version(), 'platform': platform.system(),
            **{n: importlib.metadata.version(n) for n in
               ('duckdb', 'dbt-core', 'dbt-duckdb', 'pyarrow', 'PyYAML', 'python-dotenv')}},
        'tests_run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
        'skipped': len(result.skipped), 'outcomes': result.outcomes,
        'negative_evidence': 'offline-negative.json' if (root/'offline-negative.json').exists() else None,
        'analytical_evidence': 'offline-analytics.json' if (root/'offline-analytics.json').exists() else None,
        'limitations': ['Offline fixture coverage is not real-source integration validation.',
                        'Synthetic end-to-end runner is a separate CI step.',
                        'No abrupt termination, power-loss or network-filesystem durability guarantee.']})
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(main())
