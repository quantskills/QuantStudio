# DecayReport 输出格式

## JSON Schema

```json
{
  "factor_id": "string",
  "factor_name": "string",
  "analysis_date": "YYYY-MM-DD",
  "data_period": {
    "train_val": "YYYY-MM-DD ~ YYYY-MM-DD",
    "test": "YYYY-MM-DD ~ YYYY-MM-DD",
    "n_dates": 0,
    "n_symbols": 0
  },
  "ic_decay": {
    "horizons": [1, 2, 3, 5, 10, 15, 20],
    "ic_means": [0.0, ...],
    "ic_stds": [0.0, ...],
    "icir": [0.0, ...],
    "model": "exponential",
    "model_params": {
      "ic0": 0.0,
      "tau": 0.0
    },
    "r_squared": 0.95
  },
  "half_life": {
    "days": 7.5,
    "ci_95": [5.2, 12.1],
    "method": "bootstrap",
    "n_bootstrap": 1000
  },
  "turnover_decay": {
    "rebalance_frequencies": [1, 2, 3, 5, 10, 20],
    "daily_turnover": [0.0, ...],
    "description": "日均换手率随重平衡间隔的变化"
  },
  "spread_decay": {
    "horizons": [1, 2, 3, 5, 10, 15, 20],
    "q5_q1_spread": [0.0, ...],
    "q5_return": [0.0, ...],
    "q1_return": [0.0, ...]
  },
  "recommendation": {
    "rebalance_frequency_days": 5,
    "max_holding_days": 10,
    "quality": "good",
    "notes": "IC半衰期7.5天，建议5天调仓一次"
  },
  "warnings": []
}
```

## 推荐再平衡频率判定规则

| 半衰期 τ₀.₅ | 推荐频率 | Quality |
|---|---|---|
| < 2 天 | 日频 | poor — 信号衰减过快，可能为伪 Alpha |
| 2~5 天 | 2~3 天 | moderate |
| 5~15 天 | 5~7 天 | good |
| 15~30 天 | 10~15 天 | excellent |
| > 30 天 | 月度 | exceptional — 但需警惕过拟合 |

## 危险信号 (Red Flags)

以下模式必须标为 warning：

1. **IC 不单调衰减**：某个持有期的 IC 反而更高 → 可能是数据泄漏或样本偏差
2. **半衰期 < 1 天**：日频都救不了 → 信号本质是噪声
3. **换手不衰减**：重平衡间隔加倍，换手率几乎不变 → 信号随机排列
4. **Spread 不衰减**：Q5−Q1 在长持有期保持高位 → 检查是否有 lookahead
5. **IC∞ 显著非零**：衰减到平台值仍显著 > 0 → 长期 Alpha，但需验证
