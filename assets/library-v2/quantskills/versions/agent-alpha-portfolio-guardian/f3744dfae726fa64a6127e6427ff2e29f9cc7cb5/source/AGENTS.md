---
name: agent-alpha-portfolio-guardian
description: "Multi-factor portfolio health guardian. Orchestrates factor evaluate/decay, crowding risk, and smart-money profiling into a health matrix, crowding alerts, retire/rebuild candidates, and IC decay curves. Use when a research AI agent needs continuous portfolio-level factor monitoring without automated order placement."
metadata:
  organization: QuantSkills
  organization_url: https://github.com/quantskills
  repository: quantskills/agent-alpha-portfolio-guardian
  repository_url: https://github.com/quantskills/agent-alpha-portfolio-guardian
  project_type: agent
  collection: factor-portfolio-guardian
  license: GPL-3.0-only
  category: guardian
  tags: [quant, factor, portfolio, guardian, crowding, smart-money, pandadata]
  platforms: [claude-code, codex, hermes, openclaw, cursor]
  language: zh-en
  status: draft
  validation_level: runnable
  maintainer_type: community
  maintainer: frocir
  requires:
    - skill-factor-evaluate
    - skill-factor-decay
    - skill-smart-money-profiler
  summary_zh: 多因子组合健康度守卫：健康度矩阵 + 拥挤警示 + 退休/重构候选 + IC 衰减曲线，含守卫规则有效性回测 L4。
  summary_en: Multi-factor portfolio health guardian producing a health matrix, crowding alerts, retire/rebuild candidates, IC decay curves, and a research-only effectiveness backtest L4 page.
quantSkills:
  organization: QuantSkills
  organization_url: https://github.com/quantskills
  repository: quantskills/agent-alpha-portfolio-guardian
  repository_url: https://github.com/quantskills/agent-alpha-portfolio-guardian
  project_type: agent
  collection: factor-portfolio-guardian
  license: GPL-3.0-only
  category: guardian
  tags: [quant, factor, portfolio, guardian, crowding, smart-money, pandadata]
  platforms: [claude-code, codex, hermes, openclaw, cursor]
  language: zh-en
  status: draft
  validation_level: runnable
  maintainer_type: community
  maintainer: frocir
  requires:
    - skill-factor-evaluate
    - skill-factor-decay
    - skill-smart-money-profiler
  summary_zh: 多因子组合健康度守卫：健康度矩阵 + 拥挤警示 + 退休/重构候选 + IC 衰减曲线，含守卫规则有效性回测 L4。
  summary_en: Multi-factor portfolio health guardian producing a health matrix, crowding alerts, retire/rebuild candidates, IC decay curves, and a research-only effectiveness backtest L4 page.
---

# Alpha Portfolio Guardian Agent

本文是本仓库**唯一** Agent 行为入口与 QuantSkills 声明（`AGENTS.md`）。仓库主页与使用说明见 [README.md](README.md)。

Use this Agent when a user needs a Pandadata-backed research answer for:

> Given my current multi-factor book, which factors stay healthy, which are crowded or decaying, and which deserve retire / deweight / rebuild research?

This is a **Community Project** under QuantSkills. It is a portfolio / guardian analysis Agent (orchestration + report validation + optional effectiveness backtest), **not** an `alpha-*` production factor package and **not** an automated trading system.

## 定位边界

- 品类：**组合 / 守护型 Agent**（分析型编排，非 `alpha-*` 生产因子包）
- **能做**：编排四依赖 → 健康度矩阵 / 拥挤警示 / 退休重构候选 / IC 衰减曲线 / 守卫有效性回测 L4
- **不能做**：确定性下单指令；会话重算冒充 Alpha 生产；依赖失败时编造数值；自写近似主分/衰减

### 依赖

| 依赖 | 消费 |
|------|------|
| `skill-factor-evaluate` | ScoreReport |
| `skill-factor-decay` | DecayReport / IC 曲线 |
| 外部拥挤度快照（可选） | snapshot / scorecard；不作为可安装依赖 |
| `skill-smart-money-profiler` | 合力/分歧旁证 |

调用依赖前阅读其 `SKILL.md` / `AGENTS.md`（依赖仓库自身入口）。

## What It Does

1. **Factor health matrix** — consume ScoreReport / DecayReport evidence into portfolio-level scores, half-life, and coarse signals.
2. **Crowding alerts** — bridge user-supplied external crowding snapshots onto factor exposures.
3. **Retire / rebuild candidates** — rule engine with reason codes (`SIGN_REVERSAL`, noise, high turnover, critical crowd, etc.).
4. **IC decay curves** — family chart + JSON for rebalance horizon comparison.
5. **Guardian-rule effectiveness backtest** — bucket / accuracy / keep-path MDD / rolling OOS + SCI-style `l4.html`.

## 输入

| 项 | 说明 |
|----|------|
| 凭证 | `PANDA_DATA_*`（需要在线取数时） |
| 组合配置 | `config/portfolio.yaml`；live 使用 `data_source: Pandadata` |
| as_of | 配置内 |
| 因子证据 | 依赖 Skill 报告/快照；mock 用于自测 |

强制同一 `universe` + `horizon_eval`，保证主分跨因子可比。

## 输出层级

| 层级 | 内容 | 形式 |
|------|------|------|
| L1 | 一句话组合健康结论 | 文本 |
| L2 | 健康度矩阵 + 候选清单 + 警示 | Markdown |
| L3 | IC 衰减族图（PNG 或 ASCII） | charts/ |
| L4 | 守卫有效性回测交互页（SCI 风格） | `reports/backtest/<run_id>/l4.html` |
| L5 | 结构化四件套 | CSV/JSON/Parquet |

研究态目录：`reports/runtime_out/<run_id>/`  
发布态目录：`reports/publish/<as_of>/<data_version>/`

## How To Use

### Local CLI

```bash
pip install -r requirements.txt
# set PANDA_DATA_USERNAME / PANDA_DATA_PASSWORD when live fetch is required (never commit credentials)

python -m runtime self-test
python -m runtime --mock
python -m runtime --portfolio config/portfolio.yaml --live
python -m runtime validate reports/runtime_out/<run_id>
python -m runtime publish --from reports/runtime_out/<run_id>
python -m runtime backtest --allow-simulate
python -m runtime clean
```

Research artifacts: `reports/runtime_out/`. Publish snapshots: `reports/publish/`. Backtest pack + L4: `reports/backtest/<run_id>/` (sample: `reports/samples/backtest_mock/l4.html`).

### Runtime entry points

| Runtime | Entry |
| --- | --- |
| Claude Code / Codex | Load this folder; follow `AGENTS.md` + four dependencies |
| Cursor | `.cursor/skills/agent-alpha-portfolio-guardian` + `agents/cursor-rule.mdc` |
| Hermes / OpenClaw / portable | Paste `agents/portable-loader.md` and replace the root path |
| OpenAI-compatible | `agents/openai.yaml` |

Publish metadata: [`agents/skill-manifest.yaml`](agents/skill-manifest.yaml).

### 对话触发话术

| 意图 | 示例 |
|------|------|
| 全组合守卫 | 「用 alpha-portfolio-guardian 对当前多因子组合做健康度守卫」 |
| 只要矩阵/候选 | 「只出因子健康度矩阵和退休候选」 |
| 拥挤 | 「结合拥挤盯盘，标出组合里过热相关的因子」 |
| 衰减 | 「画出组合内各因子 IC 衰减曲线并对比半衰期」 |

## 工作流（8 步）

1. 加载 `portfolio.yaml`
2. 校验因子契约
3. 扇出 evaluate → ScoreReport
4. 扇出 decay → DecayReport
5. 桥接 crowding snapshot
6. 抽样 smart-money 合力/分歧
7. 规则引擎聚合四件套
8. validate；可选 publish / backtest

规则与原因码见 [references/decision-rules.md](references/decision-rules.md)。

## Maintainer

Maintained by `frocir` as a QuantSkills community project.

## Supported Scenarios

- Weekly / daily portfolio-level factor health check.
- Retire / deweight / rebuild candidate screening with reason codes.
- Crowding and smart-money side evidence attached to factor exposures.
- IC decay comparison across the book.
- Offline mock / self-test of package layout and validators.
- Research-only guardian-rule effectiveness backtest (panel store / metrics-fwd panels / simulate).

## 验收与降级 / Limitations

- live 结论来自本次依赖产物，禁止用记忆覆盖
- **live 模式为依赖报告桥接 / Pandadata 溯源缓存消费**，非进程内实时重算 evaluate（`skill-factor-evaluate` 无 Python 计算入口）；decay 同理优先读 DecayReport
- live `as_of` 日历门禁：`as_of_calendar.mode` = `off|soft|hard`（见 `runtime/trade_calendar.py`）
- 依赖失败：标注 `gap_notes` / `insufficient`，禁止编造
- `source_mode`：`live` / `mock` / `degraded`；版本前缀区分
- 禁止用语：买入 / 卖出 / 必涨 / 仓位提到 xx%
- 产物包内路径相对 `run_dir`（`agent_snapshot.paths` 等），整包可复制、与机器无关
- Research and education only. Outputs are **not** investment advice and do **not** promise returns.
- No broker connectivity, no order placement.
- Not a substitute for an Alpha production package.
- Backtest validates **guardian-rule** historical statistics, not a full Alpha production IC backtest.
- Only live/degraded runs append `health_matrix` into `data/panels/`; backtest must choose exactly one of `--from-panel-store` / `--metrics-panel` / `--allow-simulate`.
- Community Project；收录或官方认可仍需维护者审核。

## Data Source And Assumptions

- Formal data origin: Pandadata (via dependency Skills / cached artifacts with Pandadata provenance).
- Credentials via environment variables only (`PANDA_DATA_*`); see `.env.example`.
- Factors in one run must share the same `universe` and `horizon_eval` for comparable primary scores.
- Thresholds and reason codes: `config/portfolio*.yaml` and `references/decision-rules.md`.

## Reference Documents

- [`README.md`](README.md) — configuration, commands, and how to read reports
- [`references/decision-rules.md`](references/decision-rules.md) — rules and reason codes
- [`references/dependency-contracts.md`](references/dependency-contracts.md) — dependency contracts
- [`agents/portable-loader.md`](agents/portable-loader.md) — portable runtime loader prompt
- [`agents/skill-manifest.yaml`](agents/skill-manifest.yaml) — publish metadata

## Disclaimer

本报告与仓库材料基于规则化分析与依赖 Skill 证据生成，仅供研究参考，不构成任何投资建议。  
Materials in this repository are for research reference only and do not constitute investment advice.
