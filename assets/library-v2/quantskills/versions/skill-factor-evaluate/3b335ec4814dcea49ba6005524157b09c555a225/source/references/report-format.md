# 评价报告输出格式

输出给用户时，**永远展示六联视图**（不要只给一个数）。

## 标准格式

```
=== Factor Evaluate Report ===
Factor    : f_amihud_20
Horizon   : 5d
Label     : market_neutral
Period    : 2021-12-04 → 2024-12-03 (val, 3.0y)

主分                : +0.4123    (v2 公式)
├─ IC term  (0.20) :  0.42       rank_ic_ir=2.1
├─ Shp term (0.30) :  0.85       sharpe=0.85
├─ Ret term (0.30) :  0.62       annual_ret=18.6%
├─ MDD term (0.20) :  0.47       max_dd=-22.3%
├─ Mono     (0.10) :  0.78       monotonicity=0.78
└─ Turn pen (0.10) : -0.12       ann_turnover=33.5

诊断指标（不入主分）:
  rank IC mean      : +0.038
  pearson IC mean   : +0.029     ← rank > pearson, 量级失真
  IC > 0 占比       : 62%
  Top10% 平均收益   : 0.12% / day
```

## 必含元素

1. **元信息**：Factor name / Horizon / Label kind / Period
2. **主分**：单一可比的数字
3. **分量拆解**：6 个分量各自的 raw 值 + 归一后贡献
4. **诊断指标**：双 IC 对照 + IC > 0 占比 + Top 篮收益

## 不要做的事

- ❌ 只给一个 "+0.4" 数字
- ❌ 只给"很好" / "不错" / "一般"这种主观评语
- ❌ 没有 Period —— 看不到回测区间
- ❌ 没有双 IC 对照 —— 看不出量级是否失真

## 进阶（多因子对比）

A/B 对比时用并排格式：

```
                    | F0007 (current best) | F0008 (proposed)
score               | +0.4123              | +0.4587  (+0.0464)
rank_ic_ir          | 2.1                  | 2.3
sharpe              | 0.85                 | 0.92
annual_return       | 18.6%                | 21.2%
max_drawdown        | -22.3%               | -19.8%
ann_turnover        | 33.5                 | 28.1
correlation w/ F0007| -                    | 0.42 (OK, < 0.6)

Verdict: F0008 接受 — 各项均有提升，相关性可控
```
