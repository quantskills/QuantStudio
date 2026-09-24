import asyncio
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import threading
import time
import uuid
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
from .models_service import language, parse_json
from .store import atomic_json
from .world import World, DEFAULT_HOME


class Decoration(BaseModel):
    model_config=ConfigDict(extra='forbid')
    kind:Literal['plant','table','stone','water','lamp','bed','fruit']
    x:float=Field(ge=-3,le=3,allow_inf_nan=False)
    z:float=Field(ge=-2,le=2,allow_inf_nan=False)
    size:float=Field(default=.6,ge=.15,le=1.2,allow_inf_nan=False)
    color:str=Field(default='#80a77c',pattern=r'^#[0-9a-fA-F]{6}$')


class ScenePlan(BaseModel):
    model_config=ConfigDict(extra='forbid')
    name:str=Field(min_length=1,max_length=40)
    floor:str=Field(default='#a9bda3',pattern=r'^#[0-9a-fA-F]{6}$')
    accent:str=Field(default='#edd6a5',pattern=r'^#[0-9a-fA-F]{6}$')
    decorations:list[Decoration]=Field(default_factory=list,max_length=35)


def manifest(plan):
    home={'name':plan['name'],'bounds':[-3.4,3.4,-2.4,2.4],'objects':[], 'obstacles':[]}
    # Affordances have explicit landing pads and do not inherit arbitrary names
    # or scripts from a model. Decorative volumes are accounted for separately.
    for index,item in enumerate(plan['decorations']):
        kind=item['kind'];height={'table':1.1,'plant':1.3,'stone':.45,'lamp':1.7,'water':.06,'bed':.25,'fruit':.3}[kind]*item['size']
        home['obstacles'].append({'x':item['x'],'z':item['z'],'width':item['size']*.8,'depth':item['size']*.8,'height':height})
        action={'table':'observe','plant':'interact','bed':'rest','fruit':'eat'}.get(kind)
        if action:home['objects'].append({'id':'item'+str(index),'name':{'observe':'行情台','interact':'植物','rest':'休息叶片','eat':'果实'}[action],
                                         'kind':action,'position':[item['x'],max(.2,height+.2),item['z']]})
    for goal,point in [('observe',[-2.8,.2,-1.8]),('eat',[-2.8,.2,1.8]),('rest',[2.8,.2,1.8]),('interact',[2.8,.2,-1.8])]:
        if not any(o['kind']==goal for o in home['objects']):home['objects'].append({'id':'pad_'+goal,'name':goal,'kind':goal,'position':point})
    world=World(home=home)
    if not world.clear(world.state['position']):raise ValueError('出生点被物件占据，请移动中间靠前的物件')
    for item in home['objects']:
        if not world.path(world.state['position'],item['position']):raise ValueError('交互点无法到达：'+item['id'])
    return home


def validate_glb(path):
    data=Path(path).read_bytes()
    if len(data)>50*1024*1024 or len(data)<20:raise ValueError('家园模型大小无效')
    magic,version,length=struct.unpack_from('<4sII',data)
    if magic!=b'glTF' or version!=2 or length!=len(data):raise ValueError('GLB 头无效')
    count,kind=struct.unpack_from('<II',data,12)
    if kind!=0x4e4f534a:raise ValueError('GLB 缺少场景描述')
    scene=json.loads(data[20:20+count])
    if not scene.get('meshes') or len(scene.get('nodes',[]))>2000:raise ValueError('家园网格为空或节点过多')
    if any(item.get('uri') for item in scene.get('buffers',[])+scene.get('images',[])):raise ValueError('家园不能引用外部资源')
    return {'bytes':len(data),'nodes':len(scene.get('nodes',[])),'meshes':len(scene['meshes'])}


def activate_home(organism,home,version,extra=None):
    # Finish the current neural observation/checkpoint before switching its world.
    deadline=time.monotonic()+30
    while True:
        with organism.lock:
            if organism.closed:raise ValueError('个体已退出')
            if not getattr(organism,'busy',None) and not getattr(organism,'checkpointing',False):
                old=organism.world.snapshot()
                retained={k:old[k] for k in ('energy','hunger','curiosity','stress','rng')}
                if old['decision_id'] and getattr(organism,'process',None):
                    organism.send({'kind':'abandon','head':'life','decision_id':old['decision_id']})
                    organism.store.event('life_interrupted',{'reason':'家园更换，未完成的活动不制造奖励'},decision_id=old['decision_id'])
                organism.world=World(retained,home)
                organism.world.state['home_version']=version
                organism.store.put_many({'home':home,'home_version':version,'world':organism.world.snapshot(),**(extra or {})})
                return
        if time.monotonic()>=deadline:raise ValueError('神经步尚未完成，当前家园保持不变')
        time.sleep(.1)


def start_scene(organism,description,plan=None):
    deps=organism.dependencies()
    if not deps['blender_ready']:raise ValueError('Blender 尚未准备好，请打开首次设置')
    with organism.lock:
        jobs=organism.store.get('scene_jobs',[])
        if any(j['status'] in ('planning','building','checking') for j in jobs):raise ValueError('已有家园正在生成')
        organism.store.reserve_call('scenes',organism.settings.scenes_daily,unlimited=organism.settings.model_calls_unlimited)
        job={'id':uuid.uuid4().hex,'description':description,'status':'planning','at':time.time(),'attempt':0}
        jobs.append(job);organism.store.put('scene_jobs',jobs[-30:])
    def update(**values):
        with organism.lock:
            job.update(values);items=organism.store.get('scene_jobs',[])
            organism.store.put('scene_jobs',[job if i['id']==job['id'] else i for i in items])
            organism.store.event('scene_job',dict(job),actor='scene_builder')
    def run():
        folder=organism.root/'homes'/job['id'];folder.mkdir(parents=True)
        current=plan
        error=''
        try:
            for attempt in range(3):
                if organism.closed:raise ValueError('桌面已退出，家园任务停止')
                try:
                    update(attempt=attempt+1,status='planning')
                    if current is None:
                        prompt='根据中文需求规划果蝇的低多边形家园。仅输出符合 JSON Schema 的 JSON，无文件路径、代码或工具调用。保证出生点 (0,1.7) 周围 0.5 米空闲；物件互不重叠。'+json.dumps(ScenePlan.model_json_schema(),ensure_ascii=False)
                        current=parse_json(asyncio.run(language(organism,prompt,{'purpose':'home','description':description,'previous_error':error},schema=ScenePlan.model_json_schema())))
                    validated=ScenePlan(**current).model_dump();home=manifest(validated)
                    atomic_json(folder/'plan.json',validated);atomic_json(folder/'interactions.json',home)
                    update(status='building')
                    env={k:v for k,v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','PATH','TEMP','TMP'}}
                    env.update(BLENDER_USER_CONFIG=str(folder/'config'),BLENDER_USER_SCRIPTS=str(folder/'scripts'),PYTHONUTF8='1')
                    with (folder/'build.log').open('w',encoding='utf-8') as log:
                        process=subprocess.Popen([deps['blender'],'--background','--factory-startup','--disable-autoexec','--python',str(Path(__file__).with_name('blender_build.py')),'--',str(folder)],
                                                 cwd=folder,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                        organism.scene_process=process
                        try:code=process.wait(timeout=180)
                        except subprocess.TimeoutExpired:
                            process.terminate();process.wait(timeout=5);raise ValueError('Blender 超时，已停止本次构建') from None
                        finally:organism.scene_process=None
                    if code:raise ValueError('Blender 构建未完成')
                    if organism.closed:raise ValueError('桌面已退出，保留当前家园')
                    update(status='checking')
                    report=validate_glb(folder/'home.glb')
                    if not (folder/'home.blend').is_file() or not (folder/'preview.png').is_file():raise ValueError('缺少工程或预览文件')
                    checked=json.loads((folder/'validation.json').read_text(encoding='utf-8'))
                    if not checked.get('imported_meshes'):raise ValueError('Blender 重新导入验证失败')
                    versions=organism.store.get('home_versions',[])
                    activate_home(organism,home,job['id'],{'home_versions':versions+[{'id':job['id'],'name':home['name'],'at':time.time(),'validation':report}]})
                    update(status='complete',name=home['name']);return
                except Exception as exc:
                    error=str(exc)[:350]
                    update(status='planning' if attempt<2 else 'failed',error=error)
                    if attempt<2:
                        # A configured language model repairs its own structured
                        # plan. A supplied valid plan can retry transient Blender failures.
                        if organism.settings.ai_provider:current=None
            update(status='failed',error=error+'；当前家园保持不变')
        except Exception as exc:update(status='failed',error=str(exc)[:350])
    organism.scene_thread=threading.Thread(target=run,name='fly-home-build',daemon=True)
    organism.scene_thread.start()
    return job


def restore_scene(organism,version):
    with organism.lock:
        if version=='default':home=DEFAULT_HOME
        else:
            if not any(v['id']==version for v in organism.store.get('home_versions',[])):raise ValueError('家园版本不存在')
            folder=organism.root/'homes'/version;validate_glb(folder/'home.glb')
            home=json.loads((folder/'interactions.json').read_text(encoding='utf-8'))
    activate_home(organism,home,version)
    organism.store.event('home_restored',{'version':version},actor='user')
    return {'version':version}
