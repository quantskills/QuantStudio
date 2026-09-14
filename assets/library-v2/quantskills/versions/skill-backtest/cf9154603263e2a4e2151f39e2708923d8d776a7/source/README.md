# skill-backtest

[简体中文](./README.md) | [English](./README.en.md)

不是回测框架，而是**截面多头回测的标准协议**：T+1 开盘成交、Top 等权、双边 15bp、涨跌停剔除、四联诊断图、5 项健康度自检。

`role: skill` `output: NAV + diagnostic charts` `paradigm: cross-section long-only`


---

`skill-backtest` 是 PandaAI Quant Skills 提供的**截面多头回测 Skill**。它把"信号 → 真金白银的净值曲线"这条链路标准化：用统一的成交假设、统一的手续费、统一的诊断图，让不同因子的回测结果可以横向对比。

## 🎯 这个 Skill 解决什么问题

回测最容易出 bug，且 bug 的方向永远是"让回测好看"：

- 用 `close[T]` 当 T 日成交价 → Sharpe 飙到天上
- 不剔涨跌停 → 多了买不到的收益
- 不算手续费 → 高换手策略假装能赚钱
- 用现在还活着的股票回测 2018 年 → 生存者偏差
- T+0 假设套到 A 股 → 实盘做不到

本 Skill 把这些假设**全部锁死**，再加一套 **5 项健康度自检**：

- 持仓股数稳定接近 Top X%
- 单日换手 ≈ 2/H
- Sharpe ≈ IC_IR × 0.3 ~ 0.5
- MDD 在 -20% ~ -40%
- 全仓时间占比 > 80%

任何一项不通过 → 先怀疑 bug，不要相信结果。

## ⚡ 回测协议

| 项 | 标准设定 |
|---|---|
| 选股 | 每日按 signal 截面排名取 Top 10% |
| 入场 | T+1 开盘 |
| 出场 | T+1+H 开盘 |
| 持仓 | 等权（Top N 资金均分）|
| 重叠 | 每日 1/H 资金被换仓（滚动持仓）|
| 不可买 | `trade_status==1` 或 `close >= limit_up*0.99` |
| 不可卖 | `trade_status==1` 或 `close <= limit_down*1.01` |
| 手续费 | 双边 15 bp |
| 资金 | 假设无限大、无市场冲击 |

## 🗃️ 输入要求

行情面板必须含字段：

```
date, symbol, open, close, high, low, volume,
trade_status, limit_up, limit_down
```

跨市场调整：美股没有涨跌停字段，可改用 `gap_open > 5%` 等代理；期货按品种规则。详见 `references/assumptions.md`。

## 📦 仓库内容

```
skill-backtest/
├── SKILL.md
├── README.md / README.en.md
├── references/
│   ├── assumptions.md                  # 标准假设（A股 / 美股 / 期货）
│   ├── algorithm.md                    # 滚动持仓回测核心算法
│   ├── diagnostic-charts.md            # 四联 / 六联图绘图骨架
│   ├── health-check.md                 # 5 项体检 + 诊断流
│   └── anti-patterns.md                # 10 种反模式 + 危险信号
└── agents/
    ├── openai.yaml
    ├── cursor-rule.mdc
    └── portable-loader.md
```

## 🚀 快速开始

把 `skill-backtest/` 放到 Agent 的 skill 目录下。触发词命中（"跑回测 / 画净值 / benchmark 对比"）时自动加载。

## 📊 标准诊断图（四联起步）

```
┌─────────────────────┬─────────────────────┐
│ ① 净值曲线          │ ② 累计 IC           │
│   策略 vs benchmark │   累加每日 rank IC  │
├─────────────────────┼─────────────────────┤
│ ③ 分组收益（5/10）  │ ④ 回撤              │
│   Q1 ~ Q5 柱状      │   underwater curve  │
└─────────────────────┴─────────────────────┘
```

进阶六联：再加月度热图 + 换手时序。详见 `references/diagnostic-charts.md`。

## 🧪 5 项健康度自检（跑完必做）

| 检查 | 期望 | 不通过的含义 |
|---|---|---|
| 持仓股数 | ≈ Top X% | universe 错 / 涨跌停剔过狠 |
| 换手率 | ≈ 2/H | 信号噪声主导 |
| Sharpe vs IC_IR | Sharpe ≈ IC_IR × 0.3 ~ 0.5 | close 当成交价 / 没扣手续费 / T+0 |
| MDD | -20% ~ -40% | < 5% 几乎一定是未来函数 |
| 全仓时间 | > 80% | 信号 NaN 太多 |

## 🧭 与 PandaAI Quant Skills 其它 Skill 的关系

| 仓库 | 用途 |
|---|---|
| skill-factor-mine | 提案改代码 |
| skill-factor-evaluate | 给因子打分（内含简化回测）|
| **skill-backtest**（本仓库）| 详细回测 + 诊断图 + benchmark 对照 |
| skill-ic-analysis | 不画净值，只看 IC 衰减 |
| skill-factor-debug | 回测异常时的诊断 |
| skill-factor-review | 整个因子库的回测复盘 |

## 📜 项目状态与边界

- **项目状态**：Community Project，未经官方审核 / 认证 / 背书
- **数据来源**：本仓库不附带任何市场数据。使用者需自行准备行情面板，数据合法性与许可由使用者负责
- **核心假设**：T+1 开盘成交、Top 10% 等权、双边 15bp 手续费；资金无限大、无市场冲击
- **已知限制**：不模拟集合竞价滑点 / 券池融券约束 / 大单冲击；不处理分红除权除息 / 配股 / 重大事件停牌的复杂情形
- **风险边界**：回测净值仅反映在历史数据 + 假设条件下的模拟收益，不代表未来表现，**不等同于实盘可达收益**
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
