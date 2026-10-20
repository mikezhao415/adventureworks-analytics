"""Rebuild the public fictional demo through the actual snapshot/dbt/export pipeline."""
import argparse
import json
import os
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT),str(ROOT/'tests')]
from dashboard_fixture import dashboard_records
from src.analytics import build
from src.dashboard_export import export_dashboard
from src.extract import extract

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Verify tracked demo logical content without changing it')
    args=parser.parse_args()
    root = ROOT/'output'/'dashboard-fixture'
    with patch.dict(os.environ,AW_SQL_USER='offline',AW_SQL_PASSWORD='offline'):
        extract(root/'snapshots',provider=lambda *_:dashboard_records(),validation_mode='offline_fixture')
    build(root/'snapshots',root/'analytics')
    tracked=ROOT/'apps'/'web'/'data'/'demo.json'
    result=export_dashboard(root/'analytics',root/'snapshots',root/'checked-demo.json' if args.check else tracked)
    if args.check:
        original=json.loads(tracked.read_text(encoding='utf-8'))
        assert result['content_sha256']==original['content_sha256'], 'Tracked dashboard fixture content differs'
        assert result['provenance']['input_fingerprint']==original['provenance']['input_fingerprint'], 'Fixture input fingerprint differs'
        assert original['provenance']['mode']=='offline_fixture', 'Tracked demo must be fictional'
    print('PASS: fictional dashboard fixture; content='+result['content_sha256'])
