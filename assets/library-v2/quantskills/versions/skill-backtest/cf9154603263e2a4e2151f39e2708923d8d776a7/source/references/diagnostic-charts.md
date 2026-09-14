# 标准诊断图 — 四联或六联

回测结果**必须出图**，单看数字会漏掉很多信息。

## 最低四联

```
┌─────────────────────┬─────────────────────┐
│ ① 净值曲线          │ ② 累计 IC           │
│   策略 vs benchmark │   累加每日 rank IC  │
├─────────────────────┼─────────────────────┤
│ ③ 分组收益（5/10）  │ ④ 回撤              │
│   Q1 ~ Q5 柱状      │   underwater curve  │
└─────────────────────┴─────────────────────┘
```

## 进阶六联（auto_research_alpha v2.1 风格）

```
┌──────────┬──────────┬──────────┐
│ ① 净值   │ ② 累计IC │ ③ 分组   │
├──────────┼──────────┼──────────┤
│ ④ 回撤   │ ⑤ 月度热图│ ⑥ 换手  │
└──────────┴──────────┴──────────┘
```

## 通用绘图骨架

```python
import matplotlib.pyplot as plt
import numpy as np

def plot_backtest_overview(result: dict, ic_series: pd.Series,
                            quantile_returns: pd.DataFrame,
                            benchmark_nav: pd.Series = None,
                            out_path: str = "chart_overview.png"):
    fig, axes = plt.subplots(2, 2, figsize=(14, 9))

    # ① 净值
    result["nav_curve"].plot(ax=axes[0, 0], label="strategy", lw=1.5)
    if benchmark_nav is not None:
        benchmark_nav.plot(ax=axes[0, 0], label="benchmark", lw=1, alpha=0.7)
    axes[0, 0].set_title(
        f"NAV  Sharpe={result['sharpe']:.2f}  Ret={result['annual_return']:.1%}"
    )
    axes[0, 0].legend(); axes[0, 0].grid(alpha=0.3)

    # ② 累计 IC
    ic_series.cumsum().plot(ax=axes[0, 1], color="navy")
    axes[0, 1].set_title(f"Cumulative rank IC (mean={ic_series.mean():.3f})")
    axes[0, 1].grid(alpha=0.3)

    # ③ 分组收益
    quantile_returns.mean().plot(kind="bar", ax=axes[1, 0], color="steelblue")
    axes[1, 0].set_title("Quantile mean daily return")
    axes[1, 0].grid(alpha=0.3)

    # ④ 回撤
    dd = result["nav_curve"] / result["nav_curve"].cummax() - 1
    dd.plot(ax=axes[1, 1], color="red", lw=1)
    axes[1, 1].fill_between(dd.index, dd, 0, color="red", alpha=0.3)
    axes[1, 1].set_title(f"Drawdown  MDD={result['max_drawdown']:.1%}")
    axes[1, 1].grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(out_path, dpi=120)
    plt.close()
```

## Benchmark 对齐

只看绝对收益会被 beta 蒙骗 —— 一定要和 benchmark 比：

| benchmark 候选 | 用途 |
|---|---|
| 等权选股池（CSI1000 等权） | 最严格，扣除选股池的 beta |
| 市值加权指数（HS300 / CSI500 / CSI1000） | 行业标准 |
| 当日 Top X% 等权（不带信号） | 测"Top 信号 vs 随机 Top"的纯 alpha |
| 现金 / 无风险利率 | 算 Sharpe 时的分母 |

**画图三条线起步**：策略净值 / benchmark 净值 / 超额净值（策略 - benchmark）。

## 月度热图（进阶）

```python
import seaborn as sns

def plot_monthly_heatmap(daily_ret: pd.Series, ax):
    monthly = (1 + daily_ret).resample("M").prod() - 1
    pivot = pd.DataFrame({
        "year":  monthly.index.year,
        "month": monthly.index.month,
        "ret":   monthly.values,
    }).pivot(index="year", columns="month", values="ret")
    sns.heatmap(pivot * 100, annot=True, fmt=".1f", cmap="RdYlGn",
                center=0, ax=ax, cbar_kws={"label": "%"})
    ax.set_title("Monthly returns (%)")
```

帮你一眼看到：

- 哪几年策略失效（连片红色）
- 季节性（每年某几个月特别好/差）
- 行情切换时的鲁棒性
