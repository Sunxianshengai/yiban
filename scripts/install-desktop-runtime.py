"""Install the pinned Electron runtime using its npm-supplied SHA256 manifest.
Useful when Node's downloader cannot reach GitHub. Does not change dependencies.
"""
from pathlib import Path
import hashlib,json,zipfile,requests
root=Path(__file__).resolve().parents[1]
package=root/'node_modules/electron'
version=json.loads((package/'package.json').read_text())['version']
name=f'electron-v{version}-win32-x64.zip'
expected=json.loads((package/'checksums.json').read_text())[name]
cache=root/'artifacts/electron-runtime';cache.mkdir(parents=True,exist_ok=True)
archive=cache/name
if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:
    response=requests.get(f'https://github.com/electron/electron/releases/download/v{version}/{name}',stream=True,timeout=(15,90));response.raise_for_status()
    with archive.open('wb') as output:
        for chunk in response.iter_content(1024*1024):output.write(chunk)
if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise RuntimeError('Electron checksum mismatch')
target=(package/'dist').resolve();target.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive) as source:
    for item in source.infolist():
        resolved=(target/item.filename).resolve()
        if resolved!=target and target not in resolved.parents:raise RuntimeError('Unsafe archive path')
    source.extractall(target)
(package/'path.txt').write_text('electron.exe',encoding='utf8')
print('Verified Electron',version,'installed',flush=True)
