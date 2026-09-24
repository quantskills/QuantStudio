from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from pathlib import Path
import json
import re

CATALOG = json.loads(Path(__file__).with_name('futures-products.json').read_text(encoding='utf-8'))
EXCHANGES = {item['product']: item['exchange'] for item in CATALOG}
PRODUCTS = tuple(EXCHANGES)
LIFE_ACTIONS = ('observe', 'explore', 'eat', 'rest', 'interact')
TRADE_ACTIONS = ('WAIT', 'LONG', 'SHORT', 'CLOSE')
WIDGETS = ('markets', 'positions', 'orders', 'trades', 'equity', 'intent', 'neural', 'learning', 'usage', 'life_trace', 'statistics', 'trade_learning')


class TradingFilters(BaseModel):
    trade_period_minutes: Literal[1, 5] = 1
    signal_confirmations: int = Field(default=1, ge=1, le=5)
    min_signal_margin: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)
    reentry_cooldown_minutes: int = Field(default=0, ge=0, le=120)
    cost_filter_multiplier: float = Field(default=0, ge=0, le=10, allow_inf_nan=False)


def contract_product(symbol):
    match = re.fullmatch(r'([A-Za-z]{1,3})([0-9]{3,4})([fF]?)', symbol)
    return (match[1].lower() + ('_f' if match[3] else '')) if match else None


class Instrument(BaseModel):
    product: str = Field(pattern=r'^[A-Za-z]{1,3}(?:_[fF])?$')
    symbol: str = Field(pattern=r'^[A-Za-z]{1,3}[0-9]{3,4}[fF]?$')
    exchange: Literal['SHF','DCE','CZC','CFE','INE','GFE']

    @field_validator('product')
    @classmethod
    def canonical_product(cls, value):
        # Preserve existing financial-index state keys while accepting case-insensitive input.
        return value.upper() if EXCHANGES.get(value.lower()) == 'CFE' else value.lower()

    @model_validator(mode='after')
    def matching_contract(self):
        if contract_product(self.symbol) != self.product.lower():
            raise ValueError('品种与实际合约不匹配')
        if EXCHANGES.get(self.product.lower(), self.exchange) != self.exchange:
            raise ValueError('品种与交易所不匹配')
        return self


class Settings(TradingFilters):
    instruments:list[Instrument]=Field(default_factory=list,max_length=1000)
    name: str = Field(default='小果', min_length=1, max_length=24)
    account: str = Field(default='', max_length=80)
    target_notional: float = Field(default=0, ge=0, le=100_000_000, allow_inf_nan=False)
    total_notional: float = Field(default=0, ge=0, le=500_000_000, allow_inf_nan=False)
    loss_limit: float = Field(default=0, ge=0, le=100_000_000, allow_inf_nan=False)
    jev_daily_calls: int = Field(default=0, ge=0, le=10000)
    ai_daily_calls: int = Field(default=0, ge=0, le=1000)
    scenes_daily: int = Field(default=0, ge=0, le=30)
    model_calls_unlimited: bool = False
    ai_provider: str = Field(default='',max_length=1000)
    jev_provider: Literal['typesafe'] = 'typesafe'
    jev_enabled: bool = False
    learning: bool = True
    life_validation: bool = False
    onboarding_complete: bool = False

    @field_validator('instruments')
    @classmethod
    def distinct_products(cls, items):
        if len({i.product.lower() for i in items}) != len(items):
            raise ValueError('每个品种只能配置一个实际合约')
        return items

    def trading_configured(self):
        return (not self.life_validation and bool(self.instruments)
                and (not self.total_notional or self.target_notional<=self.total_notional))


class Oracle(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class SceneRequest(BaseModel):
    description: str = Field(min_length=1, max_length=3000)
    plan: dict | None = None


class LayoutItem(BaseModel):
    id: Literal['markets','positions','orders','trades','equity','intent','neural','learning','usage','life_trace','statistics','trade_learning']
    width: int = Field(default=6, ge=3, le=12)
    height: int = Field(default=280, ge=180, le=800)


DEFAULT_LAYOUT = [dict(id=k, width=12 if k=='markets' else 6, height=320 if k=='markets' else 280)
                  for k in ('markets','intent','neural','positions','trades','learning','usage')]
DEFAULT_LAYOUT.insert(0,dict(id='life_trace',width=12,height=370))
DEFAULT_LAYOUT.insert(0,dict(id='statistics',width=12,height=620))
DEFAULT_LAYOUT.insert(0,dict(id='trade_learning',width=12,height=780))
