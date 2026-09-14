# skill-factor-decay

[简体中文](./README.md) | [English](./README.en.md)

多期限 Rank IC 衰减曲线 → 指数/幂律/双指数拟合 → Bootstrap 半衰期置信区间 → 换手衰减 + Q5-Q1 分组收益衰减 → 推荐最优再平衡频率。

`role: skill` `output: DecayReport + rebalance rec` `paradigm: daily cross-sectional IC`


---

`skill-factor-decay` 是 PandaAI Quant Skills 提供的**因子衰减分析 Skill**。回答量化研究中的核心问题：**这个因子能用多久、多久该换一次**。

## 🎯 这个 Skill 解决什么问题

IC = 0.05 的因子，在 1 天、5 天、20 天持有期上，预测力如何变化？

- 如果 IC(1d) = 0.05, IC(20d) ≈ 0 → 信号衰减快，需要每日调仓
- 如果 IC(1d) = 0.05, IC(20d) = 0.04 → 信号持久，可以月频调仓
- 如果 IC(1d) = -0.02, IC(20d) = +0.05 → **方向反转**，短期反转 + 长期动量

**不做衰减分析，你不知道最优持有期，要么过度交易、要么错过 Alpha。**

## ⚡ 7 步分析

```
1. 校验输入：signal [date×symbol] + forward returns [date×symbol×horizon]
2. 计算各期限 Rank IC 序列（Spearman）
3. 拟合 IC 衰减曲线（指数 / 幂律 / 双指数）
4. Block Bootstrap (1000次) 估计 τ₀.₅ 95% 置信区间
5. 换手率衰减（日换手率随重平衡间隔的变化）
6. 分组收益衰减（Q5−Q1 spread 随持有期的变化）
7. 输出 DecayReport（JSON + 文本报告）
```

## ⚠️ 方向反转（Sign Reversal）

A 股市场中常见 IC 方向反转：短期 IC 为负（均值回复），中长期 IC 为正（动量延续）。这不是 bug，而是真实的因子结构。

| 信号模式 | 处理方式 |
|----------|----------|
| 单边衰减 | 标准指数/幂律拟合 |
| 方向反转 | 降级为非参数，分别标注各 horizon 的 IC 符号 |
| 纯噪声 | 标记为不可用 |

## 🗃️ 输入要求

- 因子信号：`[date, symbol, factor_value]` parquet 文件
- Forward returns：1d/3d/5d/10d/20d 五个持有期（从 Pandadata OHLCV 自动计算）

## 📦 项目脚本

```bash
# 多因子衰减分析（含等权合成因子）
python decay_analysis.py
```

输入：`data/factors/F*.parquet`（或 `factors_orthogonalized/F*_residual.parquet`）
输出：
- `data/decay_reports/decay_report_*.json` — 结构化 DecayReport
- 控制台输出文本报告（IC 曲线 + 半衰期 CI + 推荐频率）

## 🔗 管线定位

```
因子挖掘 → 因子评估 → 正交化 → 衰减分析(本Skill) → 因子合并 → 回测
```

正交化之后、多因子合并之前的质量把控节点。衰减过快的因子不适合低频合并。

## 📜 License

GPL-3.0. Copyright (C) 2026 QuantSkills.
