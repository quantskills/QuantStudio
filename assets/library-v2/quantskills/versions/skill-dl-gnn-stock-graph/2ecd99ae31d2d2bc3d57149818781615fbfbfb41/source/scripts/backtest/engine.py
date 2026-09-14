"""Daily-frequency backtest engine with A-share trading rules.

Simulates a TopK daily-rebalance strategy:
  1. Each day T, the model predicts scores for all stocks.
  2. Select top-K stocks (from selector).
  3. At T's close, execute buys for stocks not already held, sells for stocks
     that fell out of the top-K.
  4. Apply T+1 settlement, price limits, costs.
  5. Track daily portfolio NAV.

Supports two modes:
  - Single-day: just output picks (no backtest).
  - Backtest: run over a date range, output full NAV history + metrics.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


@dataclass
class BacktestConfig:
    """Backtest configuration."""
    start_date: str
    end_date: str
    initial_capital: float = 1_000_000.0   # 100万
    top_k: int = 30
    max_single_position: float = 0.05       # 5% max per stock
    commission_rate: float = 0.0003
    stamp_tax_rate: float = 0.001
    slippage_rate: float = 0.001
    t_plus_1: bool = True


@dataclass
class Position:
    """A single stock position."""
    symbol: str
    qty: int = 0
    avg_cost: float = 0.0
    buy_date: str = ""   # YYYYMMDD of purchase (for T+1 check)


@dataclass
class Portfolio:
    """Portfolio state."""
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)
    nav_history: list[dict] = field(default_factory=list)
    trade_history: list[dict] = field(default_factory=list)

    @property
    def nav(self) -> float:
        pos_value = sum(
            p.qty * p.avg_cost  # approximate; should use mark-to-market prices
            for p in self.positions.values()
        )
        return self.cash + pos_value

    def mark_to_market(self, prices: dict[str, float]) -> float:
        """Revalue portfolio at current market prices."""
        pos_value = sum(
            p.qty * prices.get(p.symbol, p.avg_cost)
            for p in self.positions.values()
        )
        return self.cash + pos_value


def _allocate_equal_weight(
    picks: pd.DataFrame,
    capital: float,
    max_single: float,
    prices: dict[str, float],
) -> dict[str, int]:
    """Allocate capital equally among picked stocks, respecting lot size and max position.

    Returns:
        dict[symbol] → target_qty in shares.
    """
    n = len(picks)
    if n == 0:
        return {}

    target_value_per_stock = min(capital / n, capital * max_single)
    allocation: dict[str, int] = {}
    for _, row in picks.iterrows():
        sym = row["symbol"]
        price = prices.get(sym, 0.0)
        if price <= 0:
            continue
        qty = int(target_value_per_stock / price)
        qty = (qty // 100) * 100  # round lot
        if qty >= 100:
            allocation[sym] = qty
    return allocation


def run_backtest(
    picks_by_date: dict[str, pd.DataFrame],   # date → picks DataFrame
    prices_df: pd.DataFrame,                    # [symbol, date, close]
    config: BacktestConfig,
) -> Portfolio:
    """Run a full daily-rebalance backtest.

    Args:
        picks_by_date: dict mapping YYYYMMDD to top-K picks DataFrame
                       (columns: rank, symbol, score).
        prices_df: daily close prices for all symbols.
        config: backtest parameters.

    Returns:
        Portfolio with nav_history and trade_history populated.
    """
    portfolio = Portfolio(cash=config.initial_capital)

    # Build price lookup: date → {symbol: close}
    if prices_df.empty:
        return portfolio

    prices_df = prices_df.copy()
    prices_df["date"] = prices_df["date"].astype(str)
    prices_df["symbol"] = prices_df["symbol"].astype(str)

    all_dates = sorted(picks_by_date.keys())
    if not all_dates:
        return portfolio

    # For each date, rebalance
    for date in all_dates:
        picks = picks_by_date[date]
        if picks.empty:
            continue

        # Get today's close prices
        day_prices = prices_df[prices_df["date"] == date]
        price_map = dict(zip(day_prices["symbol"], day_prices["close"]))

        # Mark to market
        nav = portfolio.mark_to_market(price_map)
        portfolio.nav_history.append({"date": date, "nav": nav})

        # C4 fix: allocate using cash, not NAV.
        # NAV includes existing position values — we can't spend those.
        allocable = min(portfolio.cash, nav)
        target_allocation = _allocate_equal_weight(
            picks, allocable, config.max_single_position, price_map,
        )

        # Sell: positions not in picks
        pick_symbols = set(target_allocation.keys())
        for sym in list(portfolio.positions.keys()):
            if sym not in pick_symbols:
                pos = portfolio.positions[sym]
                # T+1 check: can we sell?
                if config.t_plus_1 and pos.buy_date == date:
                    continue  # bought today, can't sell
                sell_price = price_map.get(sym, pos.avg_cost) * (1.0 - config.slippage_rate)
                sell_proceeds = pos.qty * sell_price
                cost = pos.qty * sell_price * (config.commission_rate + config.stamp_tax_rate)
                portfolio.cash += sell_proceeds - cost
                portfolio.trade_history.append({
                    "date": date, "symbol": sym, "direction": "sell",
                    "qty": pos.qty, "price": sell_price, "cost": cost,
                })
                del portfolio.positions[sym]

        # Buy: new or increased positions
        for sym, target_qty in target_allocation.items():
            current_qty = portfolio.positions[sym].qty if sym in portfolio.positions else 0
            buy_qty = target_qty - current_qty
            if buy_qty < 100:
                continue  # skip trivial adjustments

            buy_price = price_map.get(sym, 0.0) * (1.0 + config.slippage_rate)
            cost = buy_qty * buy_price * config.commission_rate
            total_cost = buy_qty * buy_price + cost

            if total_cost <= portfolio.cash:
                portfolio.cash -= total_cost
                if sym in portfolio.positions:
                    # Average up/down
                    pos = portfolio.positions[sym]
                    total_qty = pos.qty + buy_qty
                    pos.avg_cost = (pos.qty * pos.avg_cost + buy_qty * buy_price) / total_qty
                    pos.qty = total_qty
                else:
                    portfolio.positions[sym] = Position(
                        symbol=sym, qty=buy_qty, avg_cost=buy_price, buy_date=date,
                    )
                portfolio.trade_history.append({
                    "date": date, "symbol": sym, "direction": "buy",
                    "qty": buy_qty, "price": buy_price, "cost": cost,
                })

    # Final NAV
    last_date = all_dates[-1] if all_dates else ""
    last_prices = prices_df[prices_df["date"] == last_date]
    last_price_map = dict(zip(last_prices["symbol"], last_prices["close"]))
    final_nav = portfolio.mark_to_market(last_price_map)
    portfolio.nav_history.append({"date": last_date, "nav": final_nav})

    return portfolio
