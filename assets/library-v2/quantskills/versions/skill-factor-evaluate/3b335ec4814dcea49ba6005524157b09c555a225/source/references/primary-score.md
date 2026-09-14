# 主分公式 — 归一加权 v2

## 设计动机

v1 用 `1.0 * IC_IR + 小权重其它` 让单一指标主导（典型 ~85% 总分由 IC_IR 贡献），导致 agent 钻空子刷 IC 而不顾年化收益和最大回撤。

**v2 把每个分量先归一到 ~[-2, +2] 量级，再按权重相加** —— 权重数字本身就是各指标"重要性比例"。

## 公式

```python
def primary_score(rank_ic_ir, sharpe, ann_ret, max_dd, mono, ann_turnover):
    """归一加权主分（v2）。范围 ~[-2, +2]。"""
    clip = lambda x, lo, hi: max(lo, min(hi, x))

    # 各分量先归一（让 1.0 ≈ "刚好不错"，2.0 ≈ "优秀"）
    ic_term   = clip(rank_ic_ir / 3.0,            -2, 2)   # IC_IR=3 → 1；6 → 2
    shp_term  = clip((sharpe + 0.5) / 1.0,        -2, 2)   # Sharpe -0.5 → 0；+1.5 → 2
    ret_term  = clip(ann_ret / 0.10,              -2, 2)   # 年化 10% → 1；20% → 2
    mdd_term  = clip(1 + max_dd / 0.30,           -2, 1)   # MDD -30% → 0；浅 → +1
    mono_term = clip(mono,                        -1, 1)
    turn_term = -clip(ann_turnover/30 - 1,         0, 3)   # 年换手 30 起惩罚

    # 加权（权重之和 = 1.20）
    return ( 0.20 * ic_term       # 截面有效性
           + 0.30 * shp_term      # 风险调整收益（主力）
           + 0.30 * ret_term      # 年化收益
           + 0.20 * mdd_term      # 最大回撤
           + 0.10 * mono_term     # 单调性
           + 0.10 * turn_term )   # 换手惩罚
```

整体 score 范围 ~[-2, +2]：
- score < 0：因子整体亏损或风险过高
- 0 ~ +0.5：勉强可用
- +0.5 ~ +1.0：合格
- +1.0 ~ +1.5：优秀
- > +1.5：怀疑有 bug

## v1 → v2 翻盘示例

| 因子 | IC_IR | Sharpe | MDD | 旧 v1 score | 新 v2 score | 评判 |
|---|---|---|---|---|---|---|
| F0009 ridge α=10 | 3.82 | -0.88 | -49.4% | +4.17 | -0.15 | 旧亚军 |
| F0010 horizon=3 | **4.12** | **-1.44** | **-65.2%** | +4.35 ⬆ | -0.59 ⬇ | **被翻盘** |

v2 下"刷 IC 不顾 MDD"的方案输给"IC 略低但 MDD 浅"的方案。

## 调权指南

| 你的研究目标 | 调整方向 |
|---|---|
| 纯统计 / 学术研究 | IC 权重提到 0.4，Sharpe / Ret 降到 0.2 |
| 实盘多头组合 | Sharpe / Ret 权重提到 0.35+，IC 降到 0.10 |
| 高换手中性策略 | 换手惩罚阈值从 30 降到 15 |
| 低频长周期 | mono_term 权重提到 0.20 |

**调权要慎重** —— 一旦改了，整个因子库的历史评分就不可比了。改公式 = 重置 journal。

## 项目已有公式时

**永远调项目内的 `primary_score()`**，不要自己另写"通用版"。这条铁律的价值：

1. **可比性**：所有因子卡用同一把尺子
2. **不可绕过**：runner 永远只读 `score` 一个数判 accept/revert
3. **审计完整**：分数差异完全归因到代码差异，不是公式差异

> 参考实现：`auto_research_alpha/prepare.py:primary_score()` + `evaluation.md §1`，是这套公式的"唯一真理来源"。
