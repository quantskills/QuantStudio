"""Private local controller. QuantStudio owns authentication and public transport."""
import asyncio
import base64
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import sys
import threading
import time
from urllib.parse import urlsplit, parse_qs

sys.path.insert(0, str(Path(__file__).parent))
from fly.service import FlyManager
from fly.models import Settings, TradingFilters, Oracle, SceneRequest, LayoutItem, DEFAULT_LAYOUT, WIDGETS
from fly.models_service import model_status, jev, oracle, generate_report, language, parse_json
from fly.environment import prepare, configure_blender
from fly.scenes import start_scene, restore_scene


def dispatch(manager, path, body=None):
    url = urlsplit(path)
    route = url.path.strip('/')
    query = {k: v[0] for k, v in parse_qs(url.query).items()}
    item = manager.get('local')
    if route == 'state' and body is None: return item.status()
    if route == 'settings' and body is not None:
        settings = Settings.model_validate(body)
        if len({i.product for i in settings.instruments}) != len(settings.instruments):
            raise ValueError('每个品种只能配置一个实际合约')
        if any(i.symbol.rstrip('0123456789').lower() != i.product.lower() for i in settings.instruments):
            raise ValueError('品种与实际合约不匹配')
        if any(i.exchange != {'IF':'CFE','IM':'CFE','au':'SHF','ag':'SHF','rb':'SHF','m':'DCE','sc':'INE'}[i.product] for i in settings.instruments):
            raise ValueError('品种与交易所不匹配')
        item.configure(settings)
        return settings.model_dump()
    if route == 'control' and body is not None:
        if body.get('action') not in ('start','pause','observe','trade','close_only','connect','history','checkpoint','restore'):
            raise ValueError('未知控制操作')
        item.command(body['action'], body.get('version', ''))
        return {'control': item.control, 'history': dict(item.history_status), 'connection': dict(item.connection)}
    if route == 'trade-filters' and body is not None:
        filters = TradingFilters.model_validate(body)
        with item.lock: item.configure(Settings(**{**item.settings.model_dump(), **filters.model_dump()}))
        return filters.model_dump()
    if route == 'events' and body is None:
        return {'events': item.store.events(max(0, int(query.get('after', 0))))}
    if route in ('statistics','analytics','learning') and body is None:
        state = item.status(); account = state.get('account') or {}
        day = query.get('day') or (account.get('official') or {}).get('TradingDay') or datetime.now().strftime('%Y%m%d')
        datetime.strptime(day, '%Y%m%d')
        if route == 'statistics':
            from fly.statistics import statistics
            return statistics(item.store.fills_since(0), state['markets'], account, day)
        if route == 'learning':
            try:
                from fly.learning_report import learning_report
            except ImportError:
                raise ValueError('请先准备神经环境，再查看学习分析') from None
            return learning_report(item.store, day, state['neural'].get('updates', {}).get('trade'))
        from fly.analytics import trading_analytics
        start = query.get('start_day') or day; end = query.get('end_day') or day
        period = query.get('period', 'raw')
        if period not in ('raw','1m','3m','5m','1h','1d'): raise ValueError('分析周期无效')
        span = (datetime.strptime(end, '%Y%m%d') - datetime.strptime(start, '%Y%m%d')).days
        if not 0 <= span <= 366: raise ValueError('分析日期范围无效')
        return trading_analytics(item.store, state['markets'], account,
            (item.store.get('binding') or {}).get('account_id', ''), day, start_day=start, end_day=end, period=period)
    if route == 'oracle' and body is not None:
        return asyncio.run(oracle(item, Oracle.model_validate(body).text))
    if route == 'report' and body is not None:
        result = asyncio.run(generate_report(item)); item.store.event('report', result, actor='reporter'); return result
    if route == 'models' and body is None: return model_status(item)
    if route == 'models/test' and body is not None:
        result = parse_json(asyncio.run(language(item, 'Return only {"ok":true}.', {'purpose':'connection_test'})))
        if result.get('ok') is not True: raise ValueError('模型连接测试未通过')
        return {'ok': True}
    if route == 'jev/test' and body is not None:
        return {'ok': True, 'choice': jev(item, {'goal':'rest'}, {'quiet':'Quiet environment'}, test=True)}
    if route == 'layout' and body is not None:
        layout = [LayoutItem.model_validate(value).model_dump() for value in body]
        if len(layout) > len(WIDGETS) or len({v['id'] for v in layout}) != len(layout): raise ValueError('组件不能重复')
        item.store.put('layout', layout); return layout
    if route == 'layout/reset' and body is not None:
        item.store.put('layout', DEFAULT_LAYOUT); return DEFAULT_LAYOUT
    if route == 'environment/prepare' and body is not None: return prepare(manager.root)
    if route == 'environment/config' and body is not None:
        value=body.get('blender_path')
        if not isinstance(value,str) or not 1<=len(value)<=2000:raise ValueError('请填写 Blender 安装路径')
        return configure_blender(manager.root,value)
    if route == 'homes' and body is not None:
        scene = SceneRequest.model_validate(body); return start_scene(item, scene.description, scene.plan)
    if route == 'homes/restore' and body is not None: return restore_scene(item, str(body.get('version', '')))
    if route.startswith('asset/') and body is None:
        parts = route.split('/')
        if len(parts) != 3: raise ValueError('资产路径无效')
        _, version, name = parts
        if name not in ('home.glb', 'preview.png'): raise ValueError('资产类型无效')
        if version == 'default':
            file = Path(__file__).parent / 'assets' / ('home.png' if name == 'preview.png' else name)
        elif any(v['id'] == version for v in item.store.get('home_versions', [])) and version.isalnum():
            file = item.root / 'homes' / version / name
        else: raise ValueError('家园版本不存在')
        if file.stat().st_size > 50 * 1024 * 1024: raise ValueError('资产过大')
        mime = 'model/gltf-binary' if name.endswith('.glb') else 'image/png'
        return {'url': 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode()}
    raise ValueError('未知果蝇接口')


def wait_for_host_shutdown():
    if os.name != 'nt':
        sys.stdin.readline()
        return
    # Blocking Windows CRT stdin locks can deadlock NumPy DLL loading in an
    # HTTP thread. Peek the pipe instead; any input or parent EOF means stop.
    import ctypes
    from ctypes import wintypes
    import msvcrt
    peek=ctypes.windll.kernel32.PeekNamedPipe
    peek.argtypes=[wintypes.HANDLE,ctypes.c_void_p,wintypes.DWORD,ctypes.c_void_p,ctypes.POINTER(wintypes.DWORD),ctypes.c_void_p]
    peek.restype=wintypes.BOOL
    handle=msvcrt.get_osfhandle(sys.stdin.fileno())
    available=wintypes.DWORD()
    while peek(handle,None,0,None,ctypes.byref(available),None) and not available.value:
        time.sleep(.1)


def main():
    # The controller shares the pinned scientific packages prepared for the brain.
    # Add the path before preparation so later imports work without a Host restart.
    sys.path.append(str(Path(sys.argv[1]) / 'dependencies' / 'python312' / 'Lib' / 'site-packages'))
    manager = FlyManager(sys.argv[1])
    token = os.environ['QUANTSTUDIO_FLY_TOKEN']
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_POST(self):
            if not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
                self.send_error(403); return
            try:
                length = int(self.headers.get('Content-Length', 0))
                if not 0 < length <= 256000: raise ValueError('请求大小无效')
                request = json.loads(self.rfile.read(length))
                result = dispatch(manager, request['path'], request.get('body'))
                payload = json.dumps({'ok': True, 'data': result}, ensure_ascii=False, allow_nan=False).encode()
            except Exception as exc:
                message = str(exc)[:500] if isinstance(exc, (ValueError, KeyError)) else '果蝇请求失败：' + type(exc).__name__
                payload = json.dumps({'ok': False, 'error': message}, ensure_ascii=False).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            try: self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError): pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    manager.resume()
    print(json.dumps({'port': server.server_port}), flush=True)
    try:
        # EOF closes the controller even if the Host crashed, without orphaning a brain.
        wait_for_host_shutdown()
    finally:
        manager.close(); server.shutdown(); server.server_close()


if __name__ == '__main__': main()
