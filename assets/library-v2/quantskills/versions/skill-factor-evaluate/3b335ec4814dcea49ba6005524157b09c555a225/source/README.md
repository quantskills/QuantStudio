# skill-factor-evaluate

[简体中文](./README.md) | [English](./README.en.md)

不是回测引擎，而是**给单个因子打综合分**的评价 Skill：双 IC + Sharpe + MDD + 单调性 + 换手 → 归一加权主分。

`role: skill` `output: ScoreReport` `paradigm: pooled cross-section`


---

`skill-factor-evaluate` 是 PandaAI Quant Skills 提供的**因子评价 Skill**。给定一个截面信号 `[date × symbol]`，它输出一份完整体检报告：截面有效性 / 风险调整收益 / 稳健性 / 换手成本，并按归一加权公式给出一个可比的主分。

它不替代项目内的 `primary_score()` —— 反之，它告诉 AI Agent **永远调项目内的实现**，避免另写"近似版"破坏评估口径一致性。

## 🎯 这个 Skill 解决什么问题

单看一个 IC 数字没法判断因子好不好：

- IC 高但 Sharpe 负 → 经典刷 IC 陷阱
- IC 高但 MDD 巨深 → 实盘必崩
- 整体 IC 平均，但小票 IC=0.08、大票 IC=0 → 容量受限
- IC 漂亮但 Pearson IC 远低于 rank IC → 量级失真

本 Skill 强制覆盖 **7 项指标**，并给出**六联拆解报告**：

- rank IC + Pearson IC（双对照）
- IC_IR
- Sharpe + 年化收益 + 最大回撤
- 5/10 分组单调性
- 年化换手率

## ⚡ 评价流程

```
1. 校验信号契约（截面规模 / 均值 / std / NaN 占比）
2. 算 rank IC + Pearson IC 时序
3. 跑多头回测：T+1 开盘买 Top 10%、等权、双边 15bp、T+1+H 卖
4. 算分组单调性（5 或 10 分位）
5. 算年化换手
6. 套主分公式 → 输出 ScoreReport
```

## 🧮 主分公式（归一加权 v2）

```
score = 0.20 * ic_term       # 截面有效性
      + 0.30 * shp_term      # Sharpe
      + 0.30 * ret_term      # 年化收益
      + 0.20 * mdd_term      # 最大回撤
      + 0.10 * mono_term     # 单调性
      + 0.10 * turn_term     # 换手惩罚
```

每个分量先归一到 ~[-2, +2]，整体 score 范围也是 ~[-2, +2]。详见 `references/primary-score.md`。

## 🗃️ 输入要求

- 信号：`[date × symbol]` 浮点 DataFrame，已截面 z-score
- 行情面板：含 `open` / `close` / `high` / `low` / `volume`
- HORIZON：必须等于信号声明的持有期

## 📦 仓库内容

```
skill-factor-evaluate/
├── SKILL.md
├── README.md / README.en.md
├── references/
│   ├── metrics.md                      # 7 项指标算法 + 通用实现
│   ├── dual-ic.md                      # rank vs Pearson 对照诊断表
│   ├── primary-score.md                # 归一加权主分公式 + 调权
│   ├── report-format.md                # 标准六联报告模板
│   └── anti-patterns.md                # 10 种反模式 + 危险信号
└── agents/
    ├── openai.yaml
    ├── cursor-rule.mdc
    └── portable-loader.md
```

## 🚀 快速开始

把 `skill-factor-evaluate/` 放到 Agent 的 skill 目录下。触发词命中（"评价因子 / 给因子打分 / factor score / evaluate factor"）时自动加载。

也可以通过 `agents/portable-loader.md` 在普通 ChatGPT 里使用。

## 📄 报告输出格式

```
=== Factor Evaluate Report ===
Factor    : f_amihud_20
Horizon   : 5d
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
```

## 🧭 与 PandaAI Quant Skills 其它 Skill 的关系

| 仓库 | 用途 |
|---|---|
| skill-factor-mine | 提案单点假设 → 改代码 |
| **skill-factor-evaluate**（本仓库）| 给改完的因子打分 |
| skill-backtest | 详细回测（净值 / 分组 / 月度热图 / benchmark 对比）|
| skill-ic-analysis | IC 多维诊断（衰减 / 子样本 / Jaccard / 时序）|
| skill-factor-debug | 评分异常时的诊断 |
| skill-factor-review | 因子库整体复盘 |

## 📜 项目状态与边界

- **项目状态**：Community Project，未经官方审核 / 认证 / 背书
- **数据来源**：本仓库不附带任何市场数据。使用者需自行准备行情面板，数据合法性与许可由使用者负责
- **核心假设**：T+1 开盘成交、Top 10% 等权、双边 15bp 手续费；A 股涨跌停 / 停牌剔除；HORIZON ∈ (1, 3, 5, 10, 20)
- **已知限制**：默认主分公式适用于多头组合中频策略，其它场景需调权（见 `references/primary-score.md`）
- **风险边界**：score 仅反映在历史数据 + 假设条件下的统计表现，不代表未来表现
- **用途**：仅供量化研究、教育与方法论参考。**不构成任何形式的投资建议、交易信号或获利保证**

## 📜 License

This repository is licensed under the GNU General Public License v3.0. See LICENSE.

Copyright (C) 2026 QuantSkills.

## 🐼 PandaAI / QUANTSKILLS 社群

<div align="center">
  <img src="https://raw.githubusercontent.com/quantskills/.github/main/profile/assets/pandaai-community-qr.jpg" alt="PandaAI 社群二维码" width="220">
  <br>
  <sub>扫码加入 PandaAI 社群，交流 QUANTSKILLS 技能、Agent 工作流与量化研究实践。</sub>
</div>
