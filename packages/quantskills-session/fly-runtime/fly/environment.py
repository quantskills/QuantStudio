"""Versioned, hash-checked portable dependencies in the user data directory."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import shutil
import threading
import time
import urllib.request
import zipfile
from .store import atomic_json

_lock=threading.Lock()
_cancel=threading.Event()
_process=None


def stop_preparation():
    _cancel.set()
    if _process and _process.poll() is None:_process.terminate()


def detect(root):
    root=Path(root);path=root/'environment.json'
    saved=json.loads(path.read_text('utf-8')) if path.exists() else {}
    config_path=root/'environment-config.json'
    config=json.loads(config_path.read_text('utf-8')) if config_path.exists() else {}
    python=os.getenv('SSQUANT_FLY_PYTHON') or saved.get('python','')
    data=os.getenv('SSQUANT_FLY_DATA') or saved.get('data','')
    blender=config.get('blender','') or os.getenv('SSQUANT_FLY_BLENDER') or saved.get('blender','') or shutil.which('blender') or ''
    progress=json.loads((root/'environment-progress.json').read_text(encoding='utf-8')) if (root/'environment-progress.json').exists() else {'status':'idle'}
    if progress.get('status')=='running' and not _lock.locked():
        progress.update(status='interrupted',message='上次准备中断，可重试；已校验的下载会复用。')
    return {'python':python,'data':data,'blender':blender,
            'brain_ready':bool(python and Path(python).is_file() and data and (Path(data)/'graph.npz').is_file()),
            'blender_ready':bool(blender and Path(blender).is_file()),
            'progress':progress}


def configure_blender(root, value):
    if _lock.locked():raise ValueError('请等待本次环境准备结束后再切换 Blender')
    path=Path(value).expanduser()
    if path.is_dir():path=path/'blender.exe'
    path=path.resolve()
    if path.name.lower()!='blender.exe' or not path.is_file():raise ValueError('请选择已有 Blender 的安装目录或 blender.exe')
    env={k:v for k,v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','PATH','TEMP','TMP','USERPROFILE'}}
    result=subprocess.run([str(path),'--version'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                          env=env,timeout=15,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    version=result.stdout.decode('utf-8',errors='replace').splitlines()
    if result.returncode or not version or not version[0].startswith('Blender '):raise ValueError('Blender 版本检查失败')
    atomic_json(Path(root)/'environment-config.json',{'blender':str(path)})
    return {'blender':str(path),'version':version[0]}


def download(url,path,digest,progress):
    path=Path(path)
    if path.exists() and hashlib.file_digest(path.open('rb'),'sha256').hexdigest()==digest:return path
    partial=path.with_suffix('.partial');path.parent.mkdir(parents=True,exist_ok=True)
    for attempt in range(3):
        try:
            if _cancel.is_set():raise ValueError('环境准备已停止')
            size=partial.stat().st_size if partial.exists() else 0
            headers={'User-Agent':'SSQuant/1.0 (portable dependency installer)'}
            if size:headers['Range']=f'bytes={size}-'
            request=urllib.request.Request(url,headers=headers)
            with urllib.request.urlopen(request,timeout=30) as response:
                if response.status!=206:size=0
                total=size+int(response.headers.get('Content-Length') or 0)
                with partial.open('ab' if size else 'wb') as out:
                    while chunk:=response.read(1024*1024):
                        if _cancel.is_set():raise ValueError('环境准备已停止')
                        out.write(chunk);size+=len(chunk);progress(done=size,total=total)
            if hashlib.file_digest(partial.open('rb'),'sha256').hexdigest()!=digest:
                partial.unlink();raise ValueError('下载文件校验失败')
            partial.replace(path);return path
        except Exception:
            if attempt==2:raise
            time.sleep(attempt+1)


def extract(archive,destination):
    destination=Path(destination).resolve();destination.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as package:
        for item in package.infolist():
            target=(destination/item.filename).resolve()
            if not target.is_relative_to(destination):raise ValueError('压缩包路径越界')
        extraction_root=str(destination)
        if os.name=='nt' and not extraction_root.startswith('\\\\?\\'):
            extraction_root=('\\\\?\\UNC\\'+extraction_root[2:]) if extraction_root.startswith('\\\\') else '\\\\?\\'+extraction_root
        package.extractall(extraction_root)


def prepare(root):
    root=Path(root)
    if not _lock.acquire(blocking=False):return {'status':'running'}
    _cancel.clear()
    atomic_json(root/'environment-progress.json',{'status':'running','stage':'starting'})
    def run():
        global _process
        def progress(stage='download',**extra):atomic_json(root/'environment-progress.json',{'status':'running','stage':stage,**extra})
        try:
            manifest=json.loads(Path(__file__).with_name('dependencies.json').read_text(encoding='utf-8'))
            deps=detect(root);folder=root/'dependencies';folder.mkdir(exist_ok=True)
            if not deps['brain_ready']:
                target=folder/'python312';progress('python')
                item=manifest['python'];extract(download(item['url'],folder/'python.zip',item['sha256'],lambda **kw:progress('python',**kw)),target)
                site=target/'Lib'/'site-packages';site.mkdir(parents=True,exist_ok=True)
                (target/'python312._pth').write_text('python312.zip\n.\nLib/site-packages\nimport site\n')
                for item in manifest['wheels']:
                    progress(item['name']);archive=download(item['url'],folder/item['name'],item['sha256'],lambda **kw:progress('packages',**kw));extract(archive,site)
                item=manifest['openfly'];archive=download(item['url'],folder/'openfly.zip',item['sha256'],lambda **kw:progress('openfly',**kw))
                with zipfile.ZipFile(archive) as package:
                    prefix='openfly-fd4b06ba0d32fa76965672777e5811da7d9171eb/'
                    for member in package.infolist():
                        if member.filename.startswith(prefix+'openfly/') and not member.is_dir():
                            path=(site/member.filename[len(prefix):]).resolve()
                            if not path.is_relative_to(site.resolve()):raise ValueError('源码包路径越界')
                            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(package.read(member))
                deps.update(python=str(target/'python.exe'),data=str(folder/'brain'))
                env={k:v for k,v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','PATH','TEMP','TMP','USERPROFILE'}}
                env.update(OPENFLY_DATA=deps['data'],PYTHONUTF8='1')
                script="from argparse import Namespace; from openfly.connectome.cli import cmd_prepare; raise SystemExit(cmd_prepare(Namespace(force=False)))"
                for attempt in range(3):
                    progress('connectome',message='正在启动连接组准备',attempt=attempt+1)
                    process=subprocess.Popen([deps['python'],'-u','-X','utf8','-B','-c',script],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                    _process=process
                    timeout=threading.Timer(1200,process.kill);timeout.daemon=True;timeout.start()
                    try:
                        for line in process.stdout:progress('connectome',message=line.strip()[:350],attempt=attempt+1)
                    finally:timeout.cancel()
                    if process.wait()==0:break
                    if _cancel.is_set():raise ValueError('环境准备已停止')
                else:raise ValueError('连接组准备失败，请重试；已下载部分会保留')
            if not deps['blender_ready']:
                item=manifest['blender'];progress('blender')
                archive=download(item['url'],folder/'blender.zip',item['sha256'],lambda **kw:progress('blender',**kw));extract(archive,folder)
                deps['blender']=str(folder/'blender-5.2.2-windows-x64'/'blender.exe')
            atomic_json(root/'environment.json',{k:deps[k] for k in ('python','data','blender')})
            atomic_json(root/'environment-progress.json',{'status':'ready','stage':'complete'})
        except Exception as exc:atomic_json(root/'environment-progress.json',{'status':'error','message':str(exc)[:350]})
        finally:_process=None;_lock.release()
    threading.Thread(target=run,daemon=True).start()
    return {'status':'running'}
