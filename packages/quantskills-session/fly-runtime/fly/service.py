"""Persistent organism host, independent of web views and window visibility."""
import hashlib
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
import uuid

from .history import readiness, missing_minutes, bars_key, history_since, history_delay, timestamp
from .scheduling import next_turn
from .models import Settings, DEFAULT_LAYOUT
from .store import Store, atomic_json
from .durability import Retry, backup
from .world import World, DEFAULT_HOME
from . import bridge
from .contest import sync as sync_contest

ACTIVE_SERVICE = None


class Organism:
    def __init__(self, manager, owner):
        self.manager=manager;self.owner=owner
        self.root=manager.root/hashlib.sha256(owner.encode()).hexdigest()
        self.store=Store(self.root)
        if not self.store.get('migration:life-readout-1'):
            layout=self.store.get('layout',DEFAULT_LAYOUT)
            if not any(item['id']=='life_trace' for item in layout):layout=[dict(id='life_trace',width=12,height=370),*layout]
            self.store.put_many({'layout':layout,'migration:life-readout-1':True})
        if not self.store.get('migration:trade-statistics-1'):
            layout=self.store.get('layout',DEFAULT_LAYOUT)
            if not any(item['id']=='statistics' for item in layout):layout=[dict(id='statistics',width=12,height=620),*layout]
            self.store.put_many({'layout':layout,'migration:trade-statistics-1':True})
        if not self.store.get('migration:trade-learning-1'):
            layout=self.store.get('layout',DEFAULT_LAYOUT)
            if not any(item['id']=='trade_learning' for item in layout):layout=[dict(id='trade_learning',width=12,height=780),*layout]
            self.store.put_many({'layout':layout,'migration:trade-learning-1':True})
        self.settings=Settings(**self.store.get('settings',{}))
        jobs=self.store.get('scene_jobs',[])
        interrupted=False
        for job in jobs:
            if job['status'] in {'planning','building','checking'}:
                job.update(status='failed',error='上次任务随桌面退出中断；当前家园已保留，可重新生成。');interrupted=True
        if interrupted:self.store.put('scene_jobs',jobs)
        if not self.store.get('settings'):
            accounts=manager.accounts
            if accounts:self.settings.account=accounts[0]['name']
        self.control=self.store.get('control',{'paused':True,'trading':False})
        self.control['trading']=False;self.store.put('control',self.control)
        if self.settings.life_validation:
            self.control['trading']=False;self.store.put('control',self.control)
        self.store.put('settings',self.settings.model_dump())
        home_version=self.store.get('home_version','default')
        body=self.store.get('world')
        if body and body.get('home_version','default')!=home_version:
            body={k:v for k,v in body.items() if k in {'energy','hunger','curiosity','stress','rng'}}
        self.world=World(body,self.store.get('home',DEFAULT_HOME))
        latest=self.root/'checkpoints'/'latest.json'
        if latest.exists():
            saved=self.store.get('checkpoint:'+json.loads(latest.read_text(encoding='utf-8'))['version'])
            if not body and saved and saved['home']==self.store.get('home',DEFAULT_HOME):
                self.world=World(saved['world'],saved['home'])
                self.store.event('checkpoint_resumed',{'offline_replay':False})
        self.world.state['home_version']=home_version
        self.lock=threading.RLock();self.process=None;self.mailbox=queue.Queue();self.busy=None
        self.neural={'status':'stopped'};self.closed=False;self.checkpointing=False
        self.last_life=0;self.last_save=0;self.last_history=0;self.last_checkpoint=time.time();self.seen={};self.trade_cursor=0;self.trade_streak=0
        self.history_lock=threading.Lock();self.last_connection=0
        self.history_status={'status':'idle','last_success_at':self.store.get('history_success_at')}
        self.history_retry=self.store.get('history_retry',{})
        self.next_history_at=0
        self.counter_lock=threading.Lock()
        self.account_cache=None;self.runtime_cache=None
        self.sent_rewards=set()
        self.counter_retry=Retry();self.neural_retry=Retry()
        self.started_at=time.time();self.busy_at=0;self.worker_activity=self.started_at
        self.backup_lock=threading.Lock();self.last_backup=0
        self.connection={'status':'idle','message':'尚未连接比赛账户'}
        self.connection_retry=self.store.get('connection_retry',{})
        self.thread=threading.Thread(target=self.loop,name='fly-organism',daemon=True);self.thread.start()

    def dependencies(self):
        from .environment import detect
        return detect(self.manager.root)

    def send(self, data):
        if not self.process or self.process.poll() is not None: raise ValueError('神经进程尚未就绪')
        self.process.stdin.write(json.dumps(data,ensure_ascii=False)+'\n');self.process.stdin.flush()

    def start(self):
        with self.lock:
            if self.process and self.process.poll() is None:
                self.control['paused']=False;self.store.put('control',self.control);return
            self.manager.claim(self.owner)
            deps=self.dependencies()
            if not deps['brain_ready']:raise ValueError('请先在首次设置中准备神经环境')
            env={k:v for k,v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'}}
            env.update(OPENFLY_DATA=deps['data'],PYTHONUTF8='1',NUMBA_NUM_THREADS='2')
            self.neural={'status':'loading'}
            self.busy=None;self.checkpointing=False;self.worker_activity=time.time()
            self.started_at=time.time()
            self.sent_rewards.clear()
            if getattr(self,'log',None):self.log.close()
            self.log=(self.root/'neural.log').open('a',encoding='utf-8')
            self.process=subprocess.Popen([deps['python'],'-u','-X','utf8','-B',str(Path(__file__).with_name('organism_worker.py')),str(self.root/'checkpoints')],
                cwd=self.root,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,encoding='utf-8',
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            def read(process):
                for line in process.stdout:
                    try:self.mailbox.put(json.loads(line))
                    except ValueError:pass
            threading.Thread(target=read,args=(self.process,),daemon=True).start()
            self.control['paused']=False;self.store.put('control',self.control)
            self.store.event('organism_started',{'offline_actions_replayed':False})

    def configure(self, settings):
        with self.lock:
            old=self.settings
            if self.control.get('trading') and any(getattr(old,k)!=getattr(settings,k) for k in ('account','instruments','target_notional','total_notional','loss_limit')):
                raise ValueError('先停止交易建议，再修改账户与额度')
            if self.store.get('binding') and settings.account!=old.account: raise ValueError('已有交易绑定，不能静默更换账户归属')
            self.settings=settings;self.store.put('settings',settings.model_dump())
            if old.trade_period_minutes!=settings.trade_period_minutes or old.instruments!=settings.instruments:
                self.last_history=0
                self.next_history_at=0
                self.store.put('history_success_at',None)
                self.history_status={**self.history_status,'status':'running' if self.history_lock.locked() else 'idle','last_success_at':None}
            if settings.life_validation:
                self.control['trading']=False;self.store.put('control',self.control)
            self.store.event('settings_changed',settings.model_dump(),actor='user')

    def command(self, action, version=''):
        with self.lock:
            if action=='start':self.start()
            elif action=='pause':
                finished=self.world.finish_life('paused')
                if finished and self.process:self.reward('life',finished['decision_id'],finished['reward'],finished)
                self.control.update(paused=True,trading=False)
                self.world.state['motor_remaining']=0.
            elif action=='observe':self.control['trading']=False
            elif action in ('trade','close_only'):
                if self.settings.life_validation:raise ValueError('当前仅验证生活，请先在设置中关闭仅验证生活')
                if not all(getattr(self.settings,k)>0 for k in ('target_notional','total_notional','loss_limit')):raise ValueError('请先设置名义金额、总占用和损失上限')
                if action=='trade' and (self.store.get('risk') or {}).get('halted'):raise ValueError('损失上限已触发；请在实盘监控核对账户，本轮不能继续开仓')
                self.start();self.request_connection();self.control.update(trading=True,close_only=action=='close_only')
            elif action=='connect': self.request_connection()
            elif action=='history': self.request_history()
            elif action=='checkpoint': self.checkpoint()
            elif action=='restore':
                if not self.control['paused'] or self.store.reservations():raise ValueError('恢复前请暂停个体，并确认没有持仓或待确认委托')
                snapshot=self.store.get('checkpoint:'+version)
                if not snapshot:raise ValueError('检查点不存在')
                if self.busy or self.checkpointing:raise ValueError('当前神经步尚未完成，请稍后恢复')
                if self.process and self.process.poll() is None:self.send({'kind':'restore','version':version})
                else:
                    policy=json.loads((self.root/'checkpoints'/version/'policy.json').read_text('utf-8'))
                    if policy.get('life_readout') and policy.get('trade_readout'):
                        atomic_json(self.root/'checkpoints'/'readouts.json',{k:policy[k] for k in ('life_readout','trade_readout')})
                    else:(self.root/'checkpoints'/'readouts.json').unlink(missing_ok=True)
                atomic_json(self.root/'checkpoints'/'latest.json',{'version':version})
                self.world=World(snapshot['world'],snapshot['home'])
                if self.neural.get('motor_controller'):self.world.enable_neural_control()
                self.world.state['home_version']=snapshot.get('home_version','default')
                self.store.put_many({'home':snapshot['home'],'home_version':snapshot.get('home_version','default'),'world':self.world.snapshot()})
                self.store.event('checkpoint_restore',{'version':version},actor='user')
            else:raise ValueError('未知控制操作')
            self.store.put('control',self.control)
            self.store.event('control',{'action':action},actor='user')

    def checkpoint(self):
        if self.process and self.neural.get('status')=='ready' and not self.checkpointing:
            self.checkpointing=True;self.send({'kind':'checkpoint'})

    def request_connection(self):
        # Contract resolution and CTP startup can wait on external services.
        # Never hold the organism/world lock across that work.
        if not self.settings.instruments:raise ValueError('请先选择品种并填写实际合约')
        if self.connection.get('status') in ('ready','connecting'):return
        if time.time()<(self.connection_retry.get('retry_at') or 0):return
        self.connection_retry.pop('blocked',None)
        self.store.put('connect_requested',True)
        self.connection={'status':'connecting','message':'正在连接柜台；家园继续运行'}
        threading.Thread(target=self.sync_counter,name='fly-counter-connect',daemon=True).start()

    def connect(self,start_cells=False):
        sync_contest(self)

    def request_history(self, manual=True):
        with self.lock:
            binding=self.store.get('binding')
            if not binding:raise ValueError('请先在果蝇设置中连接比赛账户与行情')
            if not self.settings.instruments:raise ValueError('请先选择品种并保存实际合约')
            retry_at=self.history_retry.get('retry_at') or 0
            if time.time()<retry_at:
                self.history_status={**self.history_status,**self.history_retry,'status':'cooldown'}
                self.next_history_at=retry_at
                return
            if not manual and self.history_retry.get('blocked'):return
            if not self.history_lock.acquire(blocking=False):return
            self.last_history=time.time()
            self.history_status={**self.history_status,'status':'running','started_at':self.last_history,'retry_at':None}
            try:threading.Thread(target=self.safe_backfill,args=(self.settings,binding),name='fly-history',daemon=True).start()
            except Exception:
                self.history_status={**self.history_status,'status':'error'}
                self.history_lock.release()
                raise

    def backfill(self, settings, binding):
        minutes=settings.trade_period_minutes
        errors=[]
        for item in settings.instruments:
            if self.closed:return
            error='';failure=None
            key=bars_key(item.product,minutes)
            bars=self.store.get(key,[]) if self.store.get('meta:'+key,{}).get('symbol','').lower()==item.symbol.lower() else []
            since=history_since(bars,item.product,minutes)
            # Old windows after a long absence need a fresh bootstrap, not an unbounded catch-up.
            if since and time.time()-timestamp(since)>minutes*7*86400:since=None
            try:result=bridge.call('history',{'identity':binding['identity'],'instrument':item.model_dump(),'minutes':minutes,**({'since':since} if since else {})})
            except Exception as exc:
                failure=exc;error=str(exc) if isinstance(exc,ValueError) else '历史读取失败：'+type(exc).__name__
            with self.lock:
                if self.closed:return
                if self.settings.instruments!=settings.instruments or self.settings.trade_period_minutes!=minutes or self.store.get('binding')!=binding:
                    raise ValueError('合约、周期或账户已变化，请重新获取历史数据')
                key='history_source:'+item.product+f':{minutes}m'
                previous=self.store.get(key,{})
                if previous.get('symbol',item.symbol)!=item.symbol:previous={}
                if not error:
                    try:self.store.merge_market_bars(item.product,result['bars'],item.symbol,minutes,source='PandaData')
                    except Exception as exc:error=str(exc) if isinstance(exc,ValueError) else '历史保存失败：'+type(exc).__name__
                self.store.put(key,{**previous,'source':'PandaData','symbol':item.symbol,'period_minutes':minutes,
                                    'at':previous.get('at') if error else result.get('fetched_at',time.time()),'error':error})
                if error:errors.append(item.symbol+'：'+error)
            if failure and (getattr(failure,'code','')=='RATE_LIMIT' or not getattr(failure,'retryable',True)):raise failure
        return '；'.join(errors)

    def reward(self, head, decision_id, reward, evidence):
        self.store.event('reward',{'head':head,'reward':reward,'evidence':evidence},decision_id=decision_id)
        self.send({'kind':'reward','head':head,'decision_id':decision_id,'reward':reward,'learning':self.settings.learning,
                   'decision':self.store.decision(decision_id) if head=='trade' else None})

    def consume(self,message):
        self.worker_activity=time.time()
        kind=message['kind']
        if kind=='calibration':self.neural.update(status='loading',message=f"正在标定{'生活感觉' if message.get('stage')=='life' else '神经运动'}读出 {message['done']}/{message['total']}")
        elif kind=='ready':
            self.neural={**message,'status':'ready'}
            self.neural_retry.reset()
            if message.get('motor_controller'):self.world.enable_neural_control()
        elif kind=='error':self.neural.update(status='error',message=message['message']);self.busy=None
        elif kind=='checkpoint':
            self.store.put('checkpoint:'+message['version'],{'world':self.world.snapshot(),'home':self.world.home,'home_version':self.store.get('home_version','default'),'at':time.time()})
            versions=self.store.get('checkpoints',[])+[message['version']]
            self.store.put('checkpoints',versions)
            self.checkpointing=False;self.last_checkpoint=time.time()
            self.store.event('checkpoint_saved',message)
        elif kind=='learned':self.neural['updates']=message['updates'];self.store.event('learning_update',message,decision_id=message['decision_id'])
        elif kind=='decision':
            self.busy=None;self.neural.update({k:message[k] for k in ('total_spikes','sim_ms','compute_seconds','activity')})
            if self.control['paused'] or self.closed:
                if not self.closed and getattr(self,'process',None) and self.process.poll() is None and message.get('head')=='life':
                    self.send({'kind':'abandon','head':'life','decision_id':message['decision_id']})
                return
            if message['head']=='life':
                action=message['choice']['action']
                if message.get('life_response'):
                    finished=self.world.apply_life(message)
                    if finished:self.reward('life',finished['decision_id'],finished['reward'],finished)
                    self.neural.update(motor=message['motor'],sensory=message['sensory'],life_response=message['life_response'],choice=message['choice'])
                    message['wait_reason']=self.world.waiting_status()
                elif message.get('motor'):
                    self.world.apply_motor(message['motor'],message['decision_id'])
                    self.neural.update(motor=message['motor'],sensory=message['sensory'])
                    message['wait_reason']=self.world.waiting_status()
                elif not self.world.select(action,message['decision_id']):self.reward('life',message['decision_id'],-.2,{'outcome':'目标不可达'})
                self.store.event('decision',message,actor='fly',decision_id=message['decision_id'])
                self.last_life=time.time()
                self.manager.jev_assist(self,message)
            else:
                self.store.event('decision',message,actor='fly',decision_id=message['decision_id'])
                product=message['product'];self.store.put('signal:'+product,message)
                # WAIT has no invented P&L reward. Filled decisions are settled
                # later from confirmed counter/account evidence.

    def loop(self):
        previous=time.monotonic()
        while not self.closed:
            try:
                with self.lock:
                    now=time.time();dt=min(.25,time.monotonic()-previous);previous=time.monotonic()
                    while not self.mailbox.empty():self.consume(self.mailbox.get_nowait())
                    if self.process and self.process.poll() is not None:
                        self.neural.update(status='error',message='神经进程已退出，等待检查点恢复；交易信号暂不可用')
                        if not self.control['paused'] and self.neural_retry.due(now):
                            self.neural_retry.attempted(now)
                            self.store.event('neural_recovery',{'attempt':self.neural_retry.failures,'offline_replay':False})
                            self.start()
                    # Terminate only the isolated computation worker if it
                    # stops answering. Account/CTP processes are never killed.
                    if self.process and self.process.poll() is None and (self.busy or self.checkpointing or self.neural.get('status')=='loading') and now-self.worker_activity>300:
                        self.store.event('neural_timeout',{'seconds':now-self.worker_activity})
                        self.process.terminate();self.busy=None;self.neural['status']='error'
                    if now-self.last_backup>900:
                        self.last_backup=now
                        threading.Thread(target=self.safe_backup,name='fly-local-archive',daemon=True).start()
                    if now>=self.next_history_at:
                        self.next_history_at=now+5
                        if self.store.get('binding') and self.settings.instruments:self.request_history(manual=False)
                    if now-self.last_connection>5:
                        self.last_connection=now
                        threading.Thread(target=self.sync_counter,daemon=True).start()
                    if self.neural.get('status')=='ready' and not self.control['paused'] and not self.checkpointing:
                        result=self.world.tick(dt)
                        if result:
                            if result.get('kind')=='environment_recovery':self.store.event('environment_recovery',result)
                            else:self.reward('life',result['decision_id'],result['reward'],result)
                        if not self.busy:
                            world=self.world.state
                            internal=[world['energy'],world['hunger'],world['curiosity'],world['stress'],0,0,0]
                            neural_motor=world.get('controller')=='retinal-motor-1'
                            # An egocentric observation must not be taken while
                            # the previous episode is still moving/turning the
                            # body. Otherwise its relative motor direction would
                            # be applied to a different pose after neural latency.
                            life_ready=not world.get('life_episode') and ((neural_motor and now-self.last_life>.5) or (not world['decision_id'] and now-self.last_life>2))
                            request,self.trade_cursor,self.trade_streak=next_turn(self.store,() if self.settings.life_validation else tuple(i.product for i in self.settings.instruments),
                                self.seen,self.trade_cursor,self.trade_streak,now,life_ready)
                            if request and request['head']=='life':
                                request={'head':'life','world':world,'home':self.world.home,'internal':internal,
                                         'allowed':['explore']+sorted({o['kind'] for o in self.world.home['objects']})}
                            if request:
                                request.update(kind='observe',decision_id=uuid.uuid4().hex,input_at=now)
                                self.store.archive('neural_input',request['decision_id'],request)
                                self.busy=request['decision_id'];self.send(request)
                        if now-self.last_checkpoint>180:self.checkpoint()
                    if now-self.last_save>2:
                        self.store.put_many({'world':self.world.snapshot(),'runtime_health':{
                            'at':now,'started_at':self.started_at,'neural_ready':self.neural.get('status')=='ready',
                            'pid':os.getpid(),'continuous':True}})
                        self.last_save=now
            except Exception as exc:
                self.neural['message']=f'运行时等待恢复：{type(exc).__name__}'
            time.sleep(.1)

    def safe_backup(self):
        if not self.backup_lock.acquire(blocking=False):return
        try:backup(self.store)
        except Exception as exc:
            self.last_backup=time.time()-840
            message='本地备份失败：'+type(exc).__name__
            self.store.put('persistence',{**self.store.get('persistence',{}),'ok':False,'error':message,'failed_at':time.time()})
            self.store.event('persistence_error',{'message':message})
        finally:self.backup_lock.release()

    def safe_backfill(self, settings, binding):
        error='';failure=None
        try:
            error=self.backfill(settings,binding) or ''
            if error:failure=ValueError(error)
        except Exception as exc:
            failure=exc
            error=str(exc) if isinstance(exc,ValueError) else '历史读取失败：'+type(exc).__name__
        finally:
            try:
                with self.lock:
                    if not self.closed:
                        self.store.put('history_error',error)
                        if not error:self.store.put('history_success_at',time.time())
                        self.history_retry=bridge.retry_state(self.history_retry,failure,time.time(),'pandadata') if failure else {}
                        self.store.put('history_retry',self.history_retry)
                        self.next_history_at=(self.history_retry.get('retry_at') or time.time()+history_delay([i.product for i in settings.instruments],settings.trade_period_minutes,time.time()))
                        self.history_status={'status':('error' if self.history_retry.get('blocked') else 'cooldown') if error else 'complete',**self.history_retry,
                                             'finished_at':time.time(),'last_success_at':self.store.get('history_success_at')}
            finally:self.history_lock.release()

    def sync_counter(self,wait=False):
        if self.connection_retry.get('blocked') or time.time()<(self.connection_retry.get('retry_at') or 0):return
        if not self.counter_lock.acquire(blocking=False):return
        try:
            if self.closed or not (self.store.get('binding') or self.store.get('connect_requested')):return
            sync_contest(self)
            self.connection_retry={};self.store.put('connection_retry',{})
            self.connection['updated_at']=time.time()
        except Exception as exc:
            self.control['trading']=False;self.store.put('control',self.control)
            self.connection_retry=bridge.retry_state(self.connection_retry,exc,time.time(),'competition')
            self.store.put('connection_retry',self.connection_retry)
            self.connection={'status':'needs_auth' if self.connection_retry['blocked'] else 'waiting',**self.connection_retry,
                             'message':str(exc) if isinstance(exc,ValueError) else '比赛账户暂不可用'}
        finally:self.counter_lock.release()

    def status(self):
        with self.lock:
            minutes=self.settings.trade_period_minutes
            markets=[]
            for item in self.settings.instruments:
                product=item.product
                feed=self.store.get('feed:'+product,{})
                if feed.get('symbol','').split('.')[0].lower()!=item.symbol.lower():feed={}
                key=bars_key(product,minutes)
                same_symbol=self.store.get('meta:'+key,{}).get('symbol','').lower()==item.symbol.lower()
                bars=self.store.get(key,[]) if same_symbol else []
                from .bridge import equal_notional_lots
                try:allocation=equal_notional_lots(self.settings.target_notional,float(feed.get('price') or 0),float(feed.get('multiplier') or 0))
                except ValueError:allocation=None
                markets.append({'product':product,'symbol':item.symbol,'price':feed.get('price'),'count':len(bars),
                                'period_minutes':minutes,
                                'readiness':'history_gap' if missing_minutes(bars,product,minutes) else readiness(bars,feed.get('quote_at',0),minutes=minutes), 'last_bar':bars[-1]['datetime'] if bars else None,
                                'chart':[b['close'] for b in bars], 'long':feed.get('long',0),'short':feed.get('short',0),
                                'allocation':allocation, 'quote_at':feed.get('quote_at'),
                                'decision':self.store.get('signal:'+product), 'execution':self.store.get('execution_status:'+product),
                                'signal_filter':self.store.get('trade_filter_status:'+product),
                                'pending':(self.store.get('execution:'+product) or {}).get('pending')})
                source=self.store.get('history_source:'+product+f':{minutes}m',{})
                markets[-1]['history_source']=source if source.get('symbol')==item.symbol or (same_symbol and 'symbol' not in source) else {'source':'PandaData','period_minutes':minutes}
            binding=self.store.get('binding')
            return {'name':self.settings.name,'settings':self.settings.model_dump(),'control':self.control,'neural':self.neural,
                    'world':{**{k:v for k,v in self.world.state.items() if k!='rng'},'wait_reason':self.world.waiting_status(),
                             'food':[{'id':o['id'],'name':o['name'],'position':o['position'],'available':self.world.state['food_stock'].get(o['id'],1)>0}
                                     for o in self.world.home['objects'] if o['kind']=='eat']},'home':self.world.home,'home_version':self.store.get('home_version','default'),
                    'markets':markets,'usage':self.store.usage(),'events':self.store.recent(60),'account':self.account_cache,'runtime':self.runtime_cache,
                    'trade_events':self.store.recent_kinds(('trade','order_submitted','order_return','order_error','order_unknown','execution_gate'),150),
                    'connection':dict(self.connection),
                    'persistence':self.store.get('persistence',{}),'runtime_health':self.store.get('runtime_health',{}),
                    'history_error':self.store.get('history_error',''),
                    'history':dict(self.history_status),
                    'accounts':self.manager.accounts,'binding':binding,'risk':self.store.get('risk',{}),
                    'layout':self.store.get('layout',DEFAULT_LAYOUT),'checkpoints':self.store.get('checkpoints',[])[-30:],
                    'environment':self.dependencies(),'onboarding':not self.settings.onboarding_complete,
                    'versions':self.store.get('home_versions',[]),'scene_jobs':self.store.get('scene_jobs',[])}

    def close(self):
        with self.lock:
            self.closed=True
            self.control['trading']=False
            self.store.put('control',self.control)
            self.store.put('runtime_health',{'at':time.time(),'neural_ready':False,'stopped':True})
            scene_process=getattr(self,'scene_process',None)
            if scene_process and scene_process.poll() is None:
                scene_process.terminate()
                try:scene_process.wait(timeout=5)
                except subprocess.TimeoutExpired:scene_process.kill()
            if self.process and self.process.poll() is None:
                try:
                    finished=self.world.finish_life('exit')
                    if finished:self.reward('life',finished['decision_id'],finished['reward'],finished)
                    self.send({'kind':'stop'})
                    self.process.wait(timeout=25)
                    while not self.mailbox.empty():self.consume(self.mailbox.get_nowait())
                except Exception:
                    self.store.event('checkpoint_incomplete',{'message':'保存未完成，将保留上一个有效版本'});self.process.terminate()
                    try:self.process.wait(timeout=3)
                    except subprocess.TimeoutExpired:self.process.kill()
                self.process.stdin.close();self.log.close()
            self.store.put('world',self.world.snapshot());self.closed=True
            self.store.event('organism_exited',{'offline_replay':False})
        # Finish the day's archive after final checkpoint and event commit.
        with self.backup_lock:
            try:backup(self.store)
            except Exception:pass
        self.thread.join(timeout=2)
        scene_thread=getattr(self,'scene_thread',None)
        if scene_thread:scene_thread.join(timeout=5)


class FlyManager:
    def __init__(self,root):
        global ACTIVE_SERVICE
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.accounts=[]
        self.instances={};self.lock=threading.RLock();self.active_owner=None
        ACTIVE_SERVICE=self

    def get(self,owner):
        with self.lock:
            if owner not in self.instances:self.instances[owner]=Organism(self,owner)
            return self.instances[owner]

    def claim(self,owner):
        with self.lock:
            if self.active_owner and self.active_owner!=owner:raise ValueError('本桌面已有一个运行中的果蝇个体')
            self.active_owner=owner;atomic_json(self.root/'owner.json',{'owner':owner})

    def resume(self):
        path=self.root/'owner.json'
        if path.exists():
            organism=self.get(json.loads(path.read_text(encoding='utf-8'))['owner'])
            if not organism.control['paused']:
                try:organism.start()
                except ValueError:pass

    def close(self):
        from .environment import stop_preparation
        for organism in list(self.instances.values()):organism.closed=True
        stop_preparation()
        for organism in list(self.instances.values()):organism.close()

    def jev_assist(self,organism,decision):
        if not organism.settings.jev_enabled:return
        if organism.store.get('jev_retry_at:'+organism.settings.jev_provider,0)>time.time():return
        world=organism.world.state
        now=time.time()
        needs_food=organism.world.waiting_status()
        unresolved=needs_food and needs_food['code']=='food_depleted' and world['hunger']>.25
        if world.get('life_controller'):
            food=[o for o in organism.world.home['objects'] if o['kind']=='eat']
            unresolved=bool(food) and all(world['food_stock'].get(o['id'],1)<=0 for o in food) and world['hunger']>.25
        trigger=(world['goal'],bool(world.get('motor_blocked')),world['hunger']>.25,
                 tuple(sorted(world.get('food_stock',{}).items())))
        if world.get('controller')=='retinal-motor-1':
            retry_due=unresolved and now-getattr(organism,'jev_last_assist',0)>=30
            if (trigger==getattr(organism,'jev_trigger',None) and not retry_due) or world.get('effect_remaining',0)>0:return
            if getattr(organism,'jev_pending',False):return
            organism.jev_trigger=trigger
            organism.jev_last_assist=now
        from .models_service import assist
        organism.jev_pending=True
        def run():
            try:
                if not assist(organism,decision):organism.jev_trigger=None
            finally:organism.jev_pending=False
        threading.Thread(target=run,daemon=True).start()

    def bind(self,organism):
        sync_contest(organism)
        return organism.store.get('binding')
