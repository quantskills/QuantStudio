# Alpha 多因子组合健康度守卫报告

## L1 结论

截至 2026-07-31（source_mode=mock），组合 3 个因子健康度守卫完成：keep=1，rebuild_candidate=1，watch=1。结论仅供研究参考。

- as_of: `2026-07-31`
- source_mode: `mock`
- data_version: `guardian-mock-v0.1+guardian-rules-v0.1`
- rules_version: `guardian-rules-v0.1`
- data_source: `Pandadata`

## L2 因子健康度矩阵

| factor_id | factor_name | primary_score | rank_ic | half_life | crowding_level | capital_consensus | health_status | signal | gap_notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F001 | momentum_20 | 0.25 | 0.018 | 6.0 | info | divergent | watch | watch |  |
| F002 | lowvol_20 | 0.55 | 0.032 | 12.0 | info | aligned | healthy | keep |  |
| F003 | reversal_5 | 0.05 | 0.008 | 1.5 | info | divergent | rebuild_candidate | rebuild_candidate |  |

## 拥挤度警示

| theme_or_symbol | level | scenario | linked_factor_ids |
| --- | --- | --- | --- |
| 600519.SH | info | 延续（mock） | F001,F002,F003 |

## 退休 / 重构候选清单

| factor_id | action | reasons | suggested_next_step |
| --- | --- | --- | --- |
| F003 | rebuild_candidate | SIGN_REVERSAL | IC 方向反转，建议研究调整持有期或再平衡频率后重评。 |

## IC 衰减曲线（ASCII 降级可用）

```
IC Decay (ASCII)
horizon → IC_mean
[F001]
  h=  1: +######################################## (+0.0249)
  h=  3: +################################ (+0.0198)
  h=  5: +######################### (+0.0157)
  h= 10: +############## (+0.0088)
  h= 20: +#### (+0.0028)
[F002]
  h=  1: +######################################## (+0.0330)
  h=  3: +#################################### (+0.0294)
  h=  5: +################################ (+0.0262)
  h= 10: +######################## (+0.0196)
  h= 20: +############# (+0.0110)
[F003]
  h=  1: -######################################## (-0.0134)
  h=  3: -############## (-0.0046)
  h=  5: +# (+0.0005)
  h= 10: +#################### (+0.0066)
  h= 20: +################################# (+0.0110)
```

## 方法来源

- skill-factor-evaluate
- skill-factor-decay
- agent-crowding-risk-monitor
- skill-smart-money-profiler

## 缺口标注

- mock run
- mock: trade calendar check skipped

## 免责声明

本报告基于公开数据与规则化分析生成，仅供量化研究参考，不构成任何投资建议。
