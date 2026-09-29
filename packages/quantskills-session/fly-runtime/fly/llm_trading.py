"""QS model decisions, independent of the optional neural worker.

The model only returns a target position. The existing host/CLI rechecks the
account, current position, quote and execution limits before placing an order.
"""
import threading
import time
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt

from . import bridge
from .history import bars_key
from .scheduling import next_trade

MAX_AGE = 90
MAX_CONCURRENT = 3
CONFIG_FIELDS = ('decision_engine', 'trade_model', 'trade_instructions', 'llm_max_lots')


class Answer(BaseModel):
    model_config = ConfigDict(extra='forbid')
    symbol: str = Field(min_length=1, max_length=24)
    action: Literal['WAIT', 'LONG', 'SHORT', 'CLOSE']
    target_position: StrictInt = Field(ge=-500, le=500)
    reason: str = Field(min_length=1, max_length=1200)


def engine_config(settings):
    return {key: getattr(settings, key) for key in CONFIG_FIELDS}


def parse_answer(text, request, settings):
    text = text.strip()
    if text.startswith('```') and text.endswith('```'):
        text = text.split('\n', 1)[-1].rsplit('```', 1)[0].strip()
    answer = Answer.model_validate_json(text)
    current = request['sizing']['current_position']
    target = answer.target_position
    if answer.symbol.lower() != request['symbol'].lower():
        raise ValueError('模型返回的合约与请求不一致')
    if answer.action == 'WAIT':
        if target != current: raise ValueError('等待决策不能改变持仓')
    elif answer.action == 'CLOSE':
        if target != 0 or not current: raise ValueError('平仓决策与当前持仓不一致')
    else:
        if (answer.action == 'LONG' and target <= 0) or (answer.action == 'SHORT' and target >= 0) or target == current:
            raise ValueError('模型目标仓位与方向不一致')
        reducing = current * target > 0 and abs(target) < abs(current)
        if not reducing:
            capacity = request['sizing'].get('long_capacity' if target > 0 else 'short_capacity')
            if capacity is None or abs(target) > min(settings.llm_max_lots, capacity):
                raise ValueError('模型目标仓位超过可用手数')
    return {**answer.model_dump(exclude={'symbol'}), 'current_position': current,
            'readout': 'llm-trade-1', 'sampling': False}


def infer(request, settings, account):
    system = ('你是期货模拟赛的交易决策模型。只分析输入数据，不调用工具。返回一个符合 schema 的 JSON，'
              'reason 用不超过160字的中文简述依据。bars 每行按 bar_columns 排列，价格与成交量保持原值。'
              'K线时间含时区；解释中的时间请转换为 Asia/Shanghai。'
              'target_position 是目标净持仓手数：正数为多，负数为空。'
              'WAIT 必须保持当前仓位；CLOSE 必须为 0；LONG/SHORT 必须与目标正负一致。'
              '不确定时 WAIT。不能编造未提供的新闻、价格或指标。用户交易要求：\n' + settings.trade_instructions)
    payload = {key: request[key] for key in ('symbol', 'product', 'input_at', 'signal_bar', 'filter_config', 'sizing')}
    columns=['datetime','open','high','low','close','volume']
    payload.update(bar_columns=columns,bars=[[bar[key] for key in columns] for bar in request['bars'][-60:]],
                   quote=request['quote'], portfolio={k: account.get(k) for k in ('official', 'official_positions', 'official_updated_at')},
                   max_lots=settings.llm_max_lots, close_only=request['close_only'])
    response = bridge.call('language', {'route': settings.trade_model, 'system': system,
                                      'payload': payload, 'schema': Answer.model_json_schema()})
    return parse_answer(response['text'], request, settings)


class ModelTrader:
    def __init__(self, organism):
        self.organism = organism
        self.jobs = {}
        self.seen = {}
        self.cursor = 0
        self.generation = None

    def tick(self, now):
        """Called with the organism lock held; network work never holds it."""
        o = self.organism
        if o.settings.decision_engine != 'llm' or o.closed or o.control.get('paused') or not o.control.get('trading'):
            return
        generation = (o.control.get('run_id'), o.settings.model_dump_json())
        if generation != self.generation:
            self.generation = generation
            self.seen.clear()
        products = []
        for item in o.settings.instruments:
            feed = o.store.get('feed:' + item.product, {})
            meta = o.store.get('meta:' + bars_key(item.product, o.settings.trade_period_minutes), {})
            if (feed.get('symbol', '').lower() == item.symbol.lower()
                    and meta.get('symbol', '').lower() == item.symbol.lower()):
                products.append(item.product)
        while products and len(self.jobs) < MAX_CONCURRENT:
            # Keep a stable ring while jobs finish independently. Removing busy
            # products shifts cursor indexes and can repeatedly skip a contract.
            request, self.cursor = next_trade(o.store, products, self.seen, self.cursor, now, busy=self.jobs)
            if not request: break
            product = request['product']
            feed = o.store.get('feed:' + product, {})
            request.update(decision_id=uuid.uuid4().hex, input_at=now,
                           quote={k: feed.get(k) for k in ('price', 'quote_at', 'long', 'short', 'multiplier')},
                           close_only=bool(o.control.get('close_only')))
            self.jobs[product] = request['decision_id']
            o.store.put('model_status:' + product, {'status': 'running', 'message': '大模型正在分析行情与持仓', 'at': now})
            threading.Thread(target=self.run, args=(request, o.settings.model_copy(deep=True), generation,
                             o.account_cache or {}), name='qs-model-trader', daemon=True).start()

    def run(self, request, settings, generation, account):
        o = self.organism
        product = request['product']
        error = None
        choice = None
        try:
            try:
                o.store.reserve_call('trade_model', settings.trade_daily_calls, unlimited=settings.trade_daily_calls == 0)
            except ValueError:
                error = '今日交易模型调用额度已用完，请在设置中调整或等待明日'
                raise
            o.store.archive('model_input', request['decision_id'], {**request, 'engine_config': engine_config(settings)})
            choice = infer(request, settings, account)
        except Exception as exc:
            # Never echo a provider response (which may contain private endpoint details).
            error = error or (str(exc) if isinstance(exc, bridge.BridgeError) else '模型未返回有效交易决策，请检查模型设置与运行记录')
        with o.lock:
            self.jobs.pop(product, None)
            current = (o.control.get('run_id'), o.settings.model_dump_json())
            active = not o.closed and not o.control.get('paused') and o.control.get('trading') and current == generation
            if not active:
                if not o.closed:
                    o.store.put('model_status:' + product, {'status': 'discarded', 'message': '运行设置已变化，本次输出已丢弃', 'at': time.time()})
                return
            if not error and not 0 <= time.time() - request['input_at'] <= MAX_AGE:
                error = '模型响应已过期，等待下一轮行情'
            if error:
                elapsed=round(time.time()-request['input_at'],2)
                o.store.put('model_status:' + product, {'status': 'error', 'message': error, 'at': time.time(), 'elapsed_seconds':elapsed})
                o.store.event('model_call', {'provider': 'trade_model', 'status': 'error', 'product': product, 'reason': error, 'elapsed_seconds':elapsed})
                return
            decision = {k: request[k] for k in ('product', 'symbol', 'decision_id', 'input_at', 'filter_config', 'signal_bar')}
            decision.update(head='trade', engine='llm', run_id=generation[0], engine_config=engine_config(settings), choice=choice)
            o.store.event('decision', decision, actor='language_ai', decision_id=decision['decision_id'])
            o.store.put_many({'signal:' + product: decision, 'model_status:' + product: {
                'status': 'ready', 'message': choice['reason'], 'at': time.time()}})
            o.request_execution()
