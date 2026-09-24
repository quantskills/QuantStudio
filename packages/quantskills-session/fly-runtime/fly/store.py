from __future__ import annotations
import contextlib
import json
from pathlib import Path
import sqlite3
import time
import math
import os
import hashlib
import uuid


def encode(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name+'.'+uuid.uuid4().hex+'.partial')
    with temporary.open('w',encoding='utf-8') as handle:
        handle.write(encode(value));handle.flush();os.fsync(handle.fileno())
    temporary.replace(path)


class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / 'organism.sqlite3'
        with self.connect() as db:
            db.executescript('''
                PRAGMA journal_mode=WAL;
                BEGIN IMMEDIATE;
                CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at REAL NOT NULL,
                    kind TEXT NOT NULL,actor TEXT NOT NULL,decision_id TEXT NOT NULL,payload TEXT NOT NULL,
                    dedupe TEXT UNIQUE);
                CREATE TABLE IF NOT EXISTS usage(day TEXT NOT NULL,kind TEXT NOT NULL,calls INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY(day,kind));
                CREATE TABLE IF NOT EXISTS reservations(product TEXT PRIMARY KEY,notional REAL NOT NULL,
                    decision_id TEXT NOT NULL,at REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS equity_samples(account_id TEXT NOT NULL,day TEXT NOT NULL,
                    at REAL NOT NULL,observed_at REAL NOT NULL,source TEXT NOT NULL,sample_key TEXT NOT NULL,
                    payload TEXT NOT NULL,PRIMARY KEY(account_id,day,sample_key));
                CREATE INDEX IF NOT EXISTS equity_samples_day ON equity_samples(account_id,day,at);
                CREATE TABLE IF NOT EXISTS archive(seq INTEGER PRIMARY KEY AUTOINCREMENT,at REAL NOT NULL,
                    kind TEXT NOT NULL,record_key TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(kind,record_key));
                CREATE INDEX IF NOT EXISTS archive_at ON archive(at);
                CREATE TABLE IF NOT EXISTS state_history(seq INTEGER PRIMARY KEY AUTOINCREMENT,at REAL NOT NULL,
                    key TEXT NOT NULL,value TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS state_history_at ON state_history(at);
                CREATE TRIGGER IF NOT EXISTS preserve_state_changes BEFORE INSERT ON state
                    WHEN NEW.key NOT LIKE 'feed:%' AND NEW.key NOT LIKE 'bars:%'
                    AND NEW.key NOT IN ('persistence','runtime_health')
                    AND NOT EXISTS(SELECT 1 FROM state AS previous WHERE previous.key=NEW.key AND
                      CASE WHEN NEW.key LIKE 'execution:%' THEN json_remove(previous.value,'$.quote_key','$.quote_at') ELSE previous.value END =
                      CASE WHEN NEW.key LIKE 'execution:%' THEN json_remove(NEW.value,'$.quote_key','$.quote_at') ELSE NEW.value END)
                    BEGIN INSERT INTO state_history(at,key,value)
                    VALUES((julianday('now')-2440587.5)*86400.0,NEW.key,NEW.value); END;
                DROP TRIGGER IF EXISTS preserve_state_insert;
                COMMIT;
            ''')

    @contextlib.contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA synchronous=FULL')
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def get(self, key, default=None):
        with self.connect() as db:
            row = db.execute('SELECT value FROM state WHERE key=?', (key,)).fetchone()
            return json.loads(row['value']) if row else default

    def put(self, key, value):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO state VALUES(?,?)', (key, encode(value)))

    def put_many(self, values):
        with self.connect() as db:
            db.executemany('INSERT OR REPLACE INTO state VALUES(?,?)',[(k,encode(v)) for k,v in values.items()])

    def archive(self, kind, record_key, payload, *, at=None):
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO archive(at,kind,record_key,payload) VALUES(?,?,?,?)',
                       (time.time() if at is None else at,kind,str(record_key),encode(payload)))

    def merge_market_bars(self, product, incoming, symbol='', minutes=1, source=''):
        """Merge against the latest committed window, not a pre-fetch snapshot."""
        from .history import merge_bars, session_key, timestamp, bars_key
        if minutes not in (1,3,5):raise ValueError('行情周期只能为 1、3、5 分钟')
        key=bars_key(product,minutes)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT value FROM state WHERE key=?',(key,)).fetchone()
            previous=json.loads(row[0]) if row else []
            meta=db.execute('SELECT value FROM state WHERE key=?',('meta:'+key,)).fetchone()
            if meta and symbol and json.loads(meta[0]).get('symbol','').lower()!=symbol.lower():previous=[]
            valid=[r for r in [*previous,*incoming] if session_key(timestamp(r.get('datetime',r.get('timestamp'))),product) is not None]
            # Preserve every completed input, including revisions; only the
            # neural working window is limited to 500 bars.
            if any(timestamp(r.get('datetime',r.get('timestamp')))%(minutes*60) for r in valid):
                raise ValueError('SSQUANT K 线时间与目标周期不一致，拒绝混用周期')
            complete=merge_bars([],valid,limit=None,minutes=minutes)
            binding=db.execute("SELECT value FROM state WHERE key='binding'").fetchone()
            if not symbol and binding:
                symbol=next((i['symbol'] for i in json.loads(binding[0]).get('instruments',[]) if i['product']==product),'')
            now=time.time()
            for bar in complete:
                payload=encode({'product':product,'symbol':symbol,'period':f'{minutes}m','source':source,'bar':bar})
                record_key=hashlib.sha256(payload.encode()).hexdigest()
                db.execute('INSERT OR IGNORE INTO archive(at,kind,record_key,payload) VALUES(?,?,?,?)',(now,'minute_bar' if minutes==1 else 'period_bar',record_key,payload))
            bars=complete[-500:]
            db.execute('INSERT OR REPLACE INTO state VALUES(?,?)',(key,encode(bars)))
            db.execute('INSERT OR REPLACE INTO state VALUES(?,?)',('meta:'+key,encode({'symbol':symbol,'period_minutes':minutes})))
            return bars

    def event(self, kind, payload, actor='system', decision_id='', dedupe=None, at=None):
        with self.connect() as db:
            row = db.execute('INSERT OR IGNORE INTO events(at,kind,actor,decision_id,payload,dedupe) VALUES(?,?,?,?,?,?)',
                             (time.time() if at is None else at, kind, actor, decision_id, encode(payload), dedupe))
            return row.lastrowid if row.rowcount else None

    def events(self, after=0, limit=100):
        with self.connect() as db:
            rows = db.execute('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT ?', (after, min(500, limit))).fetchall()
            return [{**dict(row), 'payload': json.loads(row['payload'])} for row in rows]

    def recent(self, limit=100):
        with self.connect() as db:
            rows = db.execute('SELECT * FROM events ORDER BY seq DESC LIMIT ?', (min(500, limit),)).fetchall()
            return [{**dict(row), 'payload': json.loads(row['payload'])} for row in reversed(rows)]

    def decision(self, decision_id):
        with self.connect() as db:
            row=db.execute("SELECT payload FROM events WHERE kind='decision' AND decision_id=? ORDER BY seq DESC LIMIT 1",(decision_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def fills_since(self, at):
        with self.connect() as db:
            return [{**dict(r),'payload':json.loads(r['payload'])} for r in db.execute("SELECT * FROM events WHERE kind='trade' AND at>=? ORDER BY seq",(at,))]

    def filled_volume(self, decision_id):
        with self.connect() as db:
            return sum(int(json.loads(r[0]).get('volume',0)) for r in db.execute("SELECT payload FROM events WHERE kind='trade' AND decision_id=?",(decision_id,)))

    def recent_kinds(self, kinds, limit=100):
        with self.connect() as db:
            marks=','.join('?' for _ in kinds)
            rows=db.execute(f'SELECT * FROM events WHERE kind IN ({marks}) ORDER BY seq DESC LIMIT ?',(*kinds,min(limit,500))).fetchall()
            return [{**dict(row),'payload':json.loads(row['payload'])} for row in reversed(rows)]

    def reserve_call(self, kind, limit, *, unlimited=False):
        if not unlimited and limit <= 0:
            raise ValueError('请先设置模型调用额度')
        day = time.strftime('%Y-%m-%d')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('INSERT OR IGNORE INTO usage VALUES(?,?,0)', (day, kind))
            if unlimited:
                db.execute('UPDATE usage SET calls=calls+1 WHERE day=? AND kind=?',(day,kind))
                return
            row = db.execute('UPDATE usage SET calls=calls+1 WHERE day=? AND kind=? AND calls<?', (day, kind, limit))
            if not row.rowcount:
                raise ValueError('今日调用额度已用完')

    def usage(self):
        with self.connect() as db:
            return {r['kind']: r['calls'] for r in db.execute('SELECT * FROM usage WHERE day=?', (time.strftime('%Y-%m-%d'),))}

    def reserve_position(self, product, notional, decision_id, maximum):
        """Cross-process budget reservation; unknown orders keep their reservation."""
        if not all(math.isfinite(x) and x>0 for x in (notional,maximum)):return False
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM reservations WHERE product=?', (product,)).fetchone():
                return False
            used = db.execute('SELECT COALESCE(SUM(notional),0) FROM reservations').fetchone()[0]
            if notional <= 0 or maximum <= 0 or used + notional > maximum:
                return False
            db.execute('INSERT INTO reservations VALUES(?,?,?,?)', (product, notional, decision_id, time.time()))
            return True

    def release_position(self, product):
        with self.connect() as db:
            db.execute('DELETE FROM reservations WHERE product=?', (product,))

    def reservations(self):
        with self.connect() as db:
            return [dict(r) for r in db.execute('SELECT * FROM reservations')]
