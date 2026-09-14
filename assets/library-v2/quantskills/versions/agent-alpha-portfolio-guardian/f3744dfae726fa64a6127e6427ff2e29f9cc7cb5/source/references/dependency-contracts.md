# 依赖契约

调用前阅读依赖方 `SKILL.md` / `AGENTS.md`。正式数据经下列 Skill 获取，溯源 Pandadata。

## skill-factor-evaluate

- 输入：截面信号、panel、horizon、universe
- 输出：ScoreReport（主分 + 六联）
- 本仓库桥接：`scripts/run_evaluate_batch.py`
- 消费字段：`primary_score`, rank/pearson IC, `ic_ir`, turnover, mdd, monotonicity

## skill-factor-decay

- 输入：信号 + 多期限 forward returns
- 输出：DecayReport JSON（见其 `references/report-format.md`）
- 本仓库桥接：`scripts/run_decay_batch.py`
- 消费字段：IC 曲线、half_life+CI、recommended_rebalance、sign_reversal、platform_ic

## agent-crowding-risk-monitor

- 优先读：`outputs/live/agent_snapshot.json`、`crowding_scorecard.json`
- 本仓库桥接：`scripts/run_crowding_bridge.py`
- 环境变量：`CROWDING_RISK_MONITOR_ROOT`
- 消费：risk_level / state → crowding_level，挂到 linked factors

## skill-smart-money-profiler

- 模式：默认 `consensus`
- 本仓库桥接：`scripts/run_smart_money_sample.py`
- live：需宿主按 Skill 执行后写入 `smart_money.sample_path`，或接受 `no_data`
- 消费：`aligned` / `divergent` / `no_data` → `capital_consensus`

## 环境变量（可选根路径）

见仓库根目录 `.env.example`。
