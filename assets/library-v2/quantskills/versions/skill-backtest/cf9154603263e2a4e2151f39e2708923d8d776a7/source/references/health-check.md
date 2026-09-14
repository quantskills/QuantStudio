# 回测健康度自检 — 5 项体检

跑完回测，**永远先做这五项体检**，再相信结果。

| 检查 | 期望 | 不通过的含义 | 修复 |
|---|---|---|---|
| **持仓股数稳定** | 每日选出股数接近 Top X%（如 Top 10% 选 ~100 只）| 涨跌停剔得太多 → universe 问题 | 检查 `limit_up` / `trade_status` 字段是否齐 |
| **换手 ≈ 200%/H** | 单日换手 ≈ 2/H（H=5 → ~40%）| 异常换手 → 信号不稳定 | 看信号每日 Top 篮子 Jaccard |
| **Sharpe vs IC_IR 量级一致** | Sharpe ≈ IC_IR × 0.3 ~ 0.5 | Sharpe 远高于 IC_IR → 涨跌停未剔 / 用 close 当成交价 | 检查时序、剔涨跌停 |
| **MDD 合理** | A 股策略 MDD ≈ -20% ~ -40% | MDD < 5% → 几乎一定是回测错误（look-ahead）| 检查 forward return 是否提前用了未来数据 |
| **全仓时间占比** | 80%+ | 频繁空仓 → 信号 NaN 太多 | 检查信号生成早期是否有大量 NaN |

## 通用体检脚本

```python
def health_check(result: dict, top_pct: float = 0.10, horizon: int = 5,
                 ic_ir: float = None) -> dict:
    """跑完回测后调用，返回 5 项体检结果。"""
    positions = result["positions"]
    n_holding = (positions > 0).sum(axis=1)
    universe_size = positions.shape[1]
    nav = result["nav_curve"]

    expected_n = universe_size * top_pct
    expected_turnover = 2 / horizon

    return {
        "持仓股数": {
            "mean":     float(n_holding.mean()),
            "expected": float(expected_n),
            "ok":       bool(0.7 * expected_n <= n_holding.mean() <= 1.1 * expected_n),
        },
        "换手率": {
            "daily_mean": float(result["turnover_series"].mean()),
            "expected":   float(expected_turnover),
            "ok":         bool(0.5 * expected_turnover <= result["turnover_series"].mean() <= 1.5 * expected_turnover),
        },
        "Sharpe vs IC_IR": {
            "sharpe":    float(result["sharpe"]),
            "ic_ir":     ic_ir,
            "ratio":     float(result["sharpe"] / ic_ir) if ic_ir else None,
            "ok":        bool(0.2 <= result["sharpe"] / ic_ir <= 0.6) if ic_ir else None,
        },
        "MDD 合理性": {
            "mdd":  float(result["max_drawdown"]),
            "ok":   bool(-0.50 < result["max_drawdown"] < -0.05),  # 太浅 = bug；太深 = 风险
        },
        "全仓时间": {
            "ratio": float((n_holding > 0).mean()),
            "ok":    bool((n_holding > 0).mean() > 0.80),
        },
    }
```

## 体检不通过时的诊断流

```
持仓股数 < 期望的 50% ?
  → 涨跌停 mask 太严？trade_status 字段缺失？

换手 > 期望的 2 倍 ?
  → 信号变化太快，怀疑是噪声主导
  → 看 Top 篮 Jaccard（见 ic-analysis skill）

Sharpe / IC_IR > 1.0 ?
  → 几乎一定是 bug：
     - 用 close[T] 当 T 日成交价
     - 没扣手续费
     - T+0 成交（A 股不允许）
     - 没剔涨跌停

MDD < 5% ?
  → 几乎一定是未来函数（look-ahead bias）
  → 检查 forward return 计算：
     ✅ open.shift(-1).pct_change(H).shift(-H)
     ❌ close.pct_change(H)（backward）
     ❌ close.shift(-H) / close - 1（用了 T 日 close 当成交价）

全仓时间 < 80% ?
  → 信号生成早期 NaN 太多 → 截掉早期段
  → 或者你的 top_pct 太严，整段空仓
```
