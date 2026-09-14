"""A-share trading rules simulation.

Enforces real-world A-share constraints:
  1. T+1 settlement: shares bought today can only be sold tomorrow.
  2. Price limit: ±10% (main board) / ±20% (ChiNext/STAR) — trades at limit are rejected.
  3. Suspension: stocks with trade_status != 0 cannot be traded.
  4. Commission + stamp tax + slippage.

All functions are pure: they take a proposed trade dict and return whether it's
executable + the adjusted fill price.
"""
from __future__ import annotations

import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
COMMISSION_RATE = 0.0003       # 0.03% per trade (buy & sell)
STAMP_TAX_RATE = 0.001         # 0.1% on sell only
SLIPPAGE_RATE = 0.001          # 0.1% adverse price movement
LIMIT_MAIN_BOARD = 0.10        # ±10% for main board (600xxx.SH, 000xxx.SZ, 002xxx.SZ)
LIMIT_CHINEXT_STAR = 0.20      # ±20% for ChiNext (300xxx.SZ) and STAR (688xxx.SH)


def board_limit(symbol: str) -> float:
    """Return the daily price limit for a stock."""
    code = symbol.split(".")[0]
    if code.startswith("300") or code.startswith("688"):
        return LIMIT_CHINEXT_STAR
    return LIMIT_MAIN_BOARD


def can_buy(
    symbol: str,
    target_qty: int,
    price: float,
    limit_up: float,
    close: float,
    trade_status: int = 0,
) -> tuple[bool, str]:
    """Check if a BUY order is executable.

    Args:
        symbol: stock code.
        target_qty: desired buy quantity in shares.
        price: reference price (close of previous day for T+1 context).
        limit_up: today's limit-up price.
        close: today's close price.
        trade_status: 0 = trading, non-0 = suspended.

    Returns:
        (executable, reason).
    """
    if trade_status != 0:
        return False, "suspended"
    if target_qty <= 0:
        return False, "zero_qty"
    if target_qty % 100 != 0:
        return False, "not_lot_size"
    if close >= limit_up * 0.999:
        return False, "limit_up"
    return True, "ok"


def can_sell(
    symbol: str,
    current_qty: int,
    sell_qty: int,
    limit_down: float,
    close: float,
    trade_status: int = 0,
    t_plus_1_held: bool = True,
) -> tuple[bool, str]:
    """Check if a SELL order is executable.

    Args:
        symbol: stock code.
        current_qty: currently held quantity.
        sell_qty: desired sell quantity.
        limit_down: today's limit-down price.
        close: today's close price.
        trade_status: 0 = trading.
        t_plus_1_held: whether shares are settled (bought yesterday or earlier).

    Returns:
        (executable, reason).
    """
    if trade_status != 0:
        return False, "suspended"
    if not t_plus_1_held:
        return False, "t_plus_1"
    if sell_qty <= 0:
        return False, "zero_qty"
    if sell_qty > current_qty:
        return False, "insufficient"
    if sell_qty % 100 != 0:
        return False, "not_lot_size"
    if close <= limit_down * 1.001:
        return False, "limit_down"
    return True, "ok"


def fill_price(
    ref_price: float,
    direction: str,  # 'buy' or 'sell'
) -> float:
    """Apply slippage to get the fill price.

    Buy: price * (1 + slippage)  — we pay slightly more.
    Sell: price * (1 - slippage) — we receive slightly less.
    """
    if direction == "buy":
        return ref_price * (1.0 + SLIPPAGE_RATE)
    else:
        return ref_price * (1.0 - SLIPPAGE_RATE)


def trade_cost(qty: int, price: float, direction: str) -> float:
    """Compute total trade cost (commission + optional stamp tax).

    Args:
        qty: number of shares.
        price: fill price per share.
        direction: 'buy' or 'sell'.

    Returns:
        Total cost in yuan (positive = cost to trader).
    """
    turnover = qty * price
    commission = turnover * COMMISSION_RATE
    stamp = turnover * STAMP_TAX_RATE if direction == "sell" else 0.0
    return commission + stamp


def round_lot(qty: int) -> int:
    """Round down to nearest 100-share lot."""
    return (qty // 100) * 100
