"""Online SQLite recovery copy and dated, verifiable local archives.

Archives use receipt dates in Shanghai, independently of counter TradingDay.
There is no retention deletion. WAL files are never copied as a live backup.
"""
from datetime import datetime, timedelta
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import time
import zipfile

from .history import TZ
from .store import atomic_json, encode


def backup_root(store):
    configured=os.getenv('SSQUANT_FLY_BACKUP_ROOT')
    return (Path(configured)/store.root.name if configured else store.root/'backups')


def archive_day(snapshot, destination, day, root):
    date=datetime.strptime(day,'%Y-%m-%d').replace(tzinfo=TZ)
    first=date.timestamp();last=(date+timedelta(days=1)).timestamp()
    target=destination/'daily'/f'{day}.zip';target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_suffix('.partial')
    counts={}
    with closing(sqlite3.connect(snapshot)) as db, zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as archive:
        db.row_factory=sqlite3.Row
        for table,column in [('events','at'),('archive','at'),('state_history','at'),('equity_samples','observed_at')]:
            count=0
            with archive.open(table+'.jsonl','w') as output:
                for row in db.execute(f'SELECT * FROM {table} WHERE {column}>=? AND {column}<?',(first,last)):
                    record=dict(row)
                    for key in ('payload','value'):
                        if key in record:record[key]=json.loads(record[key])
                    output.write((encode(record)+'\n').encode('utf-8'));count+=1
            counts[table]=count
        for table in ('state','reservations','usage'):
            archive.writestr(table+'.json',encode([dict(row) for row in db.execute(f'SELECT * FROM {table}')]))
        latest=root/'checkpoints'/'latest.json'
        if latest.exists():
            version=json.loads(latest.read_text('utf-8'))['version']
            if version.isalnum():
                for name in ('brain.npz','policy.json'):
                    path=root/'checkpoints'/version/name
                    if path.exists():archive.write(path,'checkpoint/'+name)
                archive.write(latest,'checkpoint/latest.json')
        readouts=root/'checkpoints'/'readouts.json'
        if readouts.exists():archive.write(readouts,'checkpoint/readouts.json')
        ledger=destination/'ownership.sqlite3'
        if ledger.exists():archive.write(ledger,'counter/ownership.sqlite3')
        archive.writestr('manifest.json',encode({'version':1,'receipt_day':day,'timezone':'Asia/Shanghai',
            'created_at':time.time(),'counts':counts,'scope':'本地实际记录；交易日保留在每条柜台回报中，不补造离线数据'}))
    with temporary.open('rb+') as handle:os.fsync(handle.fileno())
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip():raise OSError('归档校验失败')
    temporary.replace(target)
    with target.open('rb') as handle:digest=hashlib.file_digest(handle,'sha256').hexdigest()
    atomic_json(target.with_suffix('.sha256.json'),{'file':target.name,'sha256':digest,'counts':counts})
    return str(target)


def backup(store, *, now=None):
    now=time.time() if now is None else now
    destination=backup_root(store);destination.mkdir(parents=True,exist_ok=True)
    if min(shutil.disk_usage(store.root).free,shutil.disk_usage(destination).free)<1024**3:
        raise OSError('存档磁盘可用空间不足 1 GB')
    snapshot=destination/'recovery.partial.sqlite3'
    # sqlite3.backup includes committed WAL transactions consistently.
    with store.connect() as source, closing(sqlite3.connect(snapshot)) as target:
        source.backup(target,pages=256,sleep=.01)
        if target.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise OSError('恢复副本校验失败')
    with snapshot.open('rb+') as handle:os.fsync(handle.fileno())
    snapshot.replace(destination/'recovery.sqlite3')
    snapshot=destination/'recovery.sqlite3'
    binding=store.get('binding',{})
    account_id=binding.get('account_id','')
    state_root=os.getenv('SSQUANT_STATE_ROOT')
    if state_root and account_id and Path(account_id).name==account_id:
        native_root=Path(os.getenv('SSQUANT_ACCOUNT_RUNTIME_ROOT') or Path(state_root)/'runtime_state'/'accounts')
        ledger=native_root/account_id/'ownership.db'
        if ledger.exists():
            temporary=destination/'ownership.partial.sqlite3'
            with closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as source, closing(sqlite3.connect(temporary)) as target:
                source.backup(target,pages=256,sleep=.01)
                if target.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise OSError('柜台账本副本校验失败')
            temporary.replace(destination/'ownership.sqlite3')
    today=datetime.fromtimestamp(now,TZ).strftime('%Y-%m-%d')
    # Finish the preceding open archive at rollover/restart. Also pick up
    # historical days not yet exported, without rewriting sealed old archives.
    with closing(sqlite3.connect(snapshot)) as db:
        days={r[0] for table,col in [('events','at'),('archive','at'),('state_history','at'),('equity_samples','observed_at')]
              for r in db.execute(f"SELECT DISTINCT date({col},'unixepoch','+8 hours') FROM {table}")}
    previous=store.get('persistence',{}).get('day')
    archives=[]
    for day in sorted(days|{today}):
        if day==today or day==previous or not (destination/'daily'/f'{day}.zip').exists():
            archives.append(archive_day(snapshot,destination,day,store.root))
    # Scene assets are immutable versions and copied once, including .blend.
    for name in ('homes',):
        source=store.root/name
        if source.exists():
            for folder in source.iterdir():
                if folder.is_dir() and (folder/'home.glb').exists() and not (destination/name/folder.name).exists():
                    temporary=destination/name/(folder.name+'.partial')
                    shutil.copytree(folder,temporary,dirs_exist_ok=True)
                    temporary.rename(destination/name/folder.name)
    result={'ok':True,'at':now,'day':today,'database':str(store.path),'backup_root':str(destination),
            'daily_archive':str(destination/'daily'/f'{today}.zip'),'free_bytes':shutil.disk_usage(store.root).free,
            'retention':'永久保留，未启用自动删除','interval_seconds':900}
    store.put('persistence',result)
    return result


class Retry:
    """Bounded exponential retry. A ready counter resets the delay."""
    def __init__(self):self.failures=0;self.next_at=0
    def due(self,now):return now>=self.next_at
    def attempted(self,now):
        self.failures+=1;self.next_at=now+min(300,15*2**min(self.failures-1,5))
    def reset(self):self.failures=0;self.next_at=0
