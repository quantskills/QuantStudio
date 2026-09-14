# 因子评价的 7 项指标

任何因子评价都要同时覆盖这七个维度，**单看一个指标都会被刷**。

| 类别 | 指标 | 算法 | 解读 |
|---|---|---|---|
| **截面有效性** | rank IC | 截面 rank 后 Pearson | 对极端值稳健，A 股研究主用 |
| | Pearson IC | 截面原始值 Pearson | 捕捉强度信息，用于诊断 |
| | IC_IR | mean(IC) / std(IC) × √252 | 年化的"信号稳定性" |
| **风险调整收益** | Sharpe | annual_ret / annual_vol | 多头组合的夏普 |
| | annual return | (1+r).prod()^(252/T) - 1 | 多头年化收益 |
| | max drawdown | min(cum / cummax - 1) | 最大回撤（负数） |
| **稳健性** | monotonicity | 5 / 10 分组 IC 单调度 ∈ [-1, 1] | 分组收益是否单调 |
| **成本** | annual turnover | mean(\|w_t - w_{t-1}\|/2) × 252 | 年化双边换手率 |

## 通用实现

### 双 IC 时序

```python
import numpy as np
import pandas as pd

def _xs_corr(x: pd.DataFrame, y: pd.DataFrame) -> pd.Series:
    """逐日截面 Pearson。x、y 同 shape [date × symbol]。"""
    x = x.sub(x.mean(axis=1), axis=0)
    y = y.sub(y.mean(axis=1), axis=0)
    num = (x * y).sum(axis=1)
    den = np.sqrt((x ** 2).sum(axis=1) * (y ** 2).sum(axis=1))
    return num / den.replace(0, np.nan)

def both_ic(signal: pd.DataFrame, fwd_ret: pd.DataFrame) -> dict:
    aligned = signal.reindex_like(fwd_ret)
    rank_ic = _xs_corr(aligned.rank(axis=1), fwd_ret.rank(axis=1))
    pearson_ic = _xs_corr(aligned, fwd_ret)
    return {
        "rank_ic_mean":      rank_ic.mean(),
        "rank_ic_ir":        rank_ic.mean() / rank_ic.std() * np.sqrt(252),
        "pearson_ic_mean":   pearson_ic.mean(),
        "pearson_ic_ir":     pearson_ic.mean() / pearson_ic.std() * np.sqrt(252),
        "rank_ic_series":    rank_ic,
        "pearson_ic_series": pearson_ic,
    }
```

### Forward Return（无未来函数）

```python
def forward_return(panel: pd.DataFrame, horizon: int,
                   label_kind: str = "market_neutral") -> pd.DataFrame:
    """用 open[T+1+H] / open[T+1] - 1 算未来 H 期收益（T+1 开盘成交假设）。"""
    open_p = panel.pivot(index="date", columns="symbol", values="open").sort_index()
    fwd = open_p.shift(-1).pct_change(horizon).shift(-horizon)
    if label_kind == "market_neutral":
        fwd = fwd.sub(fwd.mean(axis=1), axis=0)
    elif label_kind == "rank":
        fwd = fwd.rank(axis=1, pct=True)
    elif label_kind == "vol_adjusted":
        # 略，见项目 prepare.py
        pass
    return fwd
```

### 单调性

```python
def monotonicity(signal: pd.DataFrame, fwd_ret: pd.DataFrame,
                  n_groups: int = 5) -> float:
    """分组收益的单调度 ∈ [-1, 1]。1 = 完全单调上升，-1 = 完全单调下降。"""
    rank = signal.rank(axis=1, pct=True)
    group_rets = []
    for q in range(n_groups):
        lo, hi = q / n_groups, (q + 1) / n_groups
        mask = (rank > lo) & (rank <= hi)
        ret = fwd_ret.where(mask).mean(axis=1)
        group_rets.append(ret.mean())
    # Spearman ρ between group_rank and group_ret
    return float(np.corrcoef(np.arange(n_groups), group_rets)[0, 1])
```

### Turnover

```python
def annual_turnover(positions: pd.DataFrame) -> float:
    """positions 是 [date × symbol] 的权重矩阵。年化双边换手 = 252 × mean(|Δw|/2)。"""
    delta = positions.diff().abs().sum(axis=1) / 2
    return float(delta.mean() * 252)
```

> 参考实现：`auto_research_alpha/prepare.py` 的 `compute_rank_ic` / `compute_pearson_ic` / `backtest` / `monotonicity_score`。
