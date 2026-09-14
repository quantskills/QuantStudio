# 数据指南

## 数据源

正式运行使用 Pandadata。本 Agent 通过依赖 Skill 消费其产物（或已落盘缓存），不单独约定其它数据商。

| 用途 | 获取方式 |
|------|----------|
| ScoreReport | skill-factor-evaluate |
| DecayReport | skill-factor-decay |
| 拥挤 snapshot | agent-crowding-risk-monitor |
| 聪明钱旁证 | skill-smart-money-profiler |

凭证：`PANDA_DATA_USERNAME` / `PANDA_DATA_PASSWORD`（需要在线取数时；已有依赖产物时可省略）。

## 溯源（可选旁路）

`{文件名}.provenance.json` 或报告内字段：`data_source`、`via_skill`、`delivery`、`data_asof`。  
样例：`provenance.example.json`。

## as_of

组合 `as_of` 为结论锚定日；缓存建议带 `data_asof`。同一组合使用同一 `universe` 与 `horizon_eval`。

时点门禁：`runtime/trade_calendar.py`，配置 `as_of_calendar.mode`：

| mode | 行为 |
|------|------|
| `off` | 不检查 |
| `soft`（默认） | 缺凭证 / API 失败 / 非交易日（未 snap）→ warning，不阻断 |
| `hard` | 上述问题硬失败 |

`snap_to_prev: true` 时非交易日回退上一交易日。mock 或 `mode=off` 跳过。旧键 `require` 仍映射为 hard/soft。

## 降级

| 情况 | 处理 |
|------|------|
| 无可用依赖产物且无凭证（live） | 运行失败 |
| 单依赖缺口 | 行级 insufficient / 警示，不编造 |
| mock | 仅自测 |

校验入口：`runtime/pandadata_gate.py` + `runtime/trade_calendar.py`。
