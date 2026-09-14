# 决策规则与原因码（guardian-rules-v0.1）

实现：`runtime/rules.py`。阈值来自 portfolio `thresholds`，并进入 `data_version`。

## 默认阈值

| 键 | 默认 | 含义 |
|----|------|------|
| `half_life_healthy` | 5.0 | τ₀.₅ ≥ 此值倾向 healthy |
| `half_life_fragile` | 2.0 | τ₀.₅ < 此值倾向 fragile |
| `primary_score_retire` | -0.5 | 主分不高于此值考虑退休/重构 |
| `ic_noise_abs` | 0.005 | \|IC\| 低于此视为噪声 |
| `high_turnover` | 0.6 | 高换手阈值 |

## 状态 → signal

| health_status | signal |
|---------------|--------|
| healthy | keep |
| watch | watch |
| fragile | deweight |
| retire_candidate | retire_candidate |
| rebuild_candidate | rebuild_candidate |
| insufficient | insufficient |

## 原因码

| 码 | 含义 |
|----|------|
| `HALF_LIFE_LT_2` | 半衰期 < 2 |
| `HALF_LIFE_2_5` | 半衰期观察带 |
| `IC_FLAT_NOISE` | 多窗 IC≈噪声 |
| `PRIMARY_SCORE_LOW` | 主分过低 |
| `SIGN_REVERSAL` | IC 方向反转 |
| `HIGH_TO_FAST_DECAY` | 高换手+快衰 |
| `CROWDING_ELEVATED` / `CROWDING_CRITICAL` | 拥挤旁证 |
| `CAPITAL_DIVERGENT` | 聪明钱分歧旁证 |
| `PLATFORM_IC_POSITIVE` | 仍有平台 IC → 倾向重构 |
| `EVAL_GAP` / `DECAY_GAP` / `SAMPLE_INSUFFICIENT` | 缺口 |

## 旁证原则

- 聪明钱**不修改** primary_score / half_life 数值
- `fragile` + `divergent` + `elevated|critical` → 提升为 `retire_candidate`
- 席位标签须注明规则匹配、非官方认定

## 合规

建议用语：可关注、建议研究降权/移出候选池、提高风险警惕。  
禁止：买入、卖出、必涨、仓位提到 xx%。
