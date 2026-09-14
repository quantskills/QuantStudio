# 双 IC 对照 — 永远同时算 rank IC 和 Pearson IC

只看一个 IC 会丢失关键信息。两者**对照**才知道因子在"排序"还是"量级"上有效。

## 算法差异

| 指标 | 算法 | 对极端值 |
|---|---|---|
| **rank IC** | 截面先 rank，再 Pearson | 稳健（rank 后极端值变 N） |
| **Pearson IC** | 截面原始值直接 Pearson | 敏感（被极端值主导） |

## 对照诊断表

| 模式 | 解读 | 行动 |
|---|---|---|
| rank IC 高、Pearson IC 低 | 因子**排序对，量级失真**（少数极端值主导） | winsorize 更严，或最终用 rank 信号 |
| Pearson IC 高、rank IC 低 | 因子**被极端值主导**，整体相关性弱 | 检查异常股、加 MAD 过滤 |
| 两者都高且接近 | 因子**分布良好** | 健康，进入下一步 |
| 两者都低（< 0.02） | 因子**无效** | 删除或重设计 |

## 数值参考

A 股截面研究（CSI1000 等中盘）的常见量级：

| 指标 | 弱 | 中 | 强 | 极强（怀疑有 bug） |
|---|---|---|---|---|
| rank IC mean | < 0.02 | 0.02 ~ 0.04 | 0.04 ~ 0.08 | > 0.10 |
| rank IC_IR | < 1.0 | 1.0 ~ 2.5 | 2.5 ~ 5.0 | > 6.0 |
| Pearson IC | 通常 ≈ rank IC × 0.7 ~ 0.9 | | | |

如果 IC > 0.15 但 Sharpe / MDD 不行 → 几乎一定是**未来函数 bug**，不是真信号（见 factor-debug skill）。

## 主分中只用 rank IC 的原因

- A 股横截面噪声大，极端值（涨跌停 / 复牌 / 借壳）频繁
- rank 后噪声被压平，信号更稳定
- 实盘组合按截面排名选股，rank 直接对应交易决策

Pearson IC 仅作诊断，不进主分。但写入 `ScoreReport` 与因子卡，agent 可在 `metrics.py` 自由扩展使用。

> 参考实现：`auto_research_alpha/evaluation.md §4`，prepare 同时暴露两套 API。
