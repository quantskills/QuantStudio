# 回测核心算法

通用骨架（不依赖任何项目）。

## 滚动持仓多头回测

```python
import numpy as np
import pandas as pd

def backtest_long_only(
    signal: pd.DataFrame,        # [date × symbol], 已截面 z-score
    panel: pd.DataFrame,         # 长表: date / symbol / open / close / high / low /
                                 #       volume / limit_up / limit_down / trade_status
    horizon: int = 5,
    top_pct: float = 0.10,
    fee_bps: float = 15,         # 双边手续费基点
) -> dict:
    """
    返回 dict 含：
        nav_curve: pd.Series 日频净值
        daily_ret: pd.Series 日频组合收益
        positions: pd.DataFrame [date × symbol] 当日权重
        turnover_series: pd.Series 日频换手
        annual_return / sharpe / max_drawdown / annual_turnover
    """
    open_p = panel.pivot(index="date", columns="symbol", values="open").sort_index()
    trade_status = panel.pivot(index="date", columns="symbol", values="trade_status")
    limit_up = panel.pivot(index="date", columns="symbol", values="limit_up")
    limit_down = panel.pivot(index="date", columns="symbol", values="limit_down")
    close = panel.pivot(index="date", columns="symbol", values="close")

    # 1. 信号 → 选股矩阵：每日 Top X%
    rank = signal.rank(axis=1, pct=True)
    selected = (rank >= 1 - top_pct).astype(float)

    # 2. 不可买/不可卖掩码
    can_buy  = (trade_status != 1) & (close < limit_up * 0.99)
    can_sell = (trade_status != 1) & (close > limit_down * 1.01)

    # 3. 滚动持仓：每日 1/H 资金进出
    positions = pd.DataFrame(0.0, index=open_p.index, columns=open_p.columns)
    sleeves = []  # 队列：[(entry_date, weights_series), ...]，长度上限 = horizon
    daily_ret = pd.Series(0.0, index=open_p.index)
    daily_turnover = pd.Series(0.0, index=open_p.index)

    for i, t in enumerate(open_p.index):
        # (a) 卖出到期 sleeve（持有满 H 天的）
        if len(sleeves) >= horizon:
            sleeves.pop(0)

        # (b) 新开仓 sleeve（用 T 日 signal，T+1 开盘买入 ─ 注意时序错位）
        if i + 1 < len(open_p.index):
            t_next = open_p.index[i + 1]
            row = selected.loc[t] if t in selected.index else None
            if row is not None and row.sum() > 0:
                w = row / row.sum() / horizon  # 每个 sleeve 占 1/H 资金
                w = w * can_buy.loc[t_next].astype(float)  # 涨停剔除
                if w.sum() > 0:
                    w = w / w.sum() / horizon
                sleeves.append((t_next, w))

        # (c) 当前权重 = 所有活跃 sleeve 之和
        positions.loc[t] = sum(
            (w for _, w in sleeves),
            pd.Series(0.0, index=positions.columns),
        )

        # (d) 当日收益 = 持仓 · 当日收益（用 close-to-close 近似日间，再减手续费）
        if i > 0:
            t_prev = open_p.index[i - 1]
            day_ret = close.loc[t] / close.loc[t_prev] - 1
            day_ret = day_ret.fillna(0)
            daily_ret.loc[t] = (positions.loc[t_prev] * day_ret).sum()
            # 换手 = |Δw|.sum() / 2
            delta = (positions.loc[t] - positions.loc[t_prev]).abs().sum() / 2
            daily_turnover.loc[t] = delta
            # 扣手续费
            daily_ret.loc[t] -= delta * 2 * fee_bps / 1e4

    # 4. 净值与指标
    nav = (1 + daily_ret).cumprod()
    annual_return = nav.iloc[-1] ** (252 / len(nav)) - 1
    sharpe = daily_ret.mean() / daily_ret.std() * np.sqrt(252)
    drawdown = nav / nav.cummax() - 1
    max_drawdown = drawdown.min()
    annual_turnover = daily_turnover.mean() * 252

    return {
        "nav_curve": nav,
        "daily_ret": daily_ret,
        "positions": positions,
        "turnover_series": daily_turnover,
        "annual_return": float(annual_return),
        "sharpe": float(sharpe),
        "max_drawdown": float(max_drawdown),
        "annual_turnover": float(annual_turnover),
    }
```

## 关键时序细节

**信号是 T 日收盘后才有，所以只能用 T+1 开盘成交**。如果代码里出现 `close[T] * (1 + signal[T])` 这种"T 日收盘买卖"，就是未来函数。

正确时序：

```
T 日 close → 算出 signal[T]
T+1 日 open → 用 signal[T] 选股、成交
T+1+H 日 open → 平仓
```

## 性能优化

如果 N（股票）× T（天数）很大（如 4000 × 2500 = 10M+），上面的 for 循环可能慢。优化方向：

1. 把 `sleeves` 用矩阵化（持仓矩阵 + 滞后 H 天的入场矩阵差分）
2. 用 numpy 而不是 pandas 做核心循环
3. 用 numba @jit 装饰回测函数

但**先求正确再求快** —— 正确的慢算法 > 快的错算法。
