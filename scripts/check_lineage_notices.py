"""Verify reviewed dependency versions and notices against the installed lockfile."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check():
    web = ROOT / 'apps/web'
    inventory = json.loads((ROOT / 'docs/lineage/custom-viewer-dependencies.json').read_text(encoding='utf-8'))
    lock = json.loads((web / 'package-lock.json').read_text(encoding='utf-8'))['packages']
    served = (web / 'public/notices/custom-lineage-dependencies.txt').read_text(encoding='utf-8')
    for entry in inventory:
        installed = web / entry['install_path']
        package = json.loads((installed / 'package.json').read_text(encoding='utf-8'))
        pinned = lock[entry['install_path']]
        if package['version'] != entry['version'] or pinned['version'] != entry['version'] or pinned['integrity'] != entry['integrity']:
            raise ValueError('Unreviewed dependency version: ' + entry['name'])
        for notice in entry['notices']:
            # Registry archives have a single package-name/package directory.
            relative = Path(notice['path'].split('/', 1)[1])
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('Invalid notice path')
            raw = (installed / relative).read_bytes()
            if hashlib.sha256(raw).hexdigest() != notice['sha256']:
                raise ValueError('Changed reviewed notice: ' + entry['name'])
            if raw.decode('utf-8').replace('\r\n', '\n').strip() not in served.replace('\r\n', '\n'):
                raise ValueError('Missing served notice: ' + entry['name'])
    return len(inventory)


if __name__ == '__main__':
    print(f'Verified {check()} reviewed dependency versions and notices.')
