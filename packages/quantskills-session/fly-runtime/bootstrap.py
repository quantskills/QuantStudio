"""Install only the pinned, hash-verified wheels needed by the local controller."""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

root = Path(sys.executable).parent
site = root / 'Lib' / 'site-packages'
site.mkdir(parents=True, exist_ok=True)
(root / 'python312._pth').write_text('python312.zip\n.\nLib/site-packages\nimport site\n')
for item in json.loads(Path(__file__).with_name('bootstrap-wheels.json').read_text('utf-8-sig')):
    path = root / item['name']
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        with urllib.request.urlopen(item['url'], timeout=60) as response:
            data = response.read(32 * 1024 * 1024)
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError('Runtime dependency checksum mismatch')
        path.write_bytes(data)
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            if not (site / member.filename).resolve().is_relative_to(site.resolve()):
                raise ValueError('Unsafe wheel path')
        archive.extractall(site)
print('ready', flush=True)
