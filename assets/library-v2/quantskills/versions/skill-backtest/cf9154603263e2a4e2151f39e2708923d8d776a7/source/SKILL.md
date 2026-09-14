---
name: backtest
description: Use when an agent needs a standard cross-sectional long-only backtest
  protocol with T+1 open execution, top-bucket equal weighting, fees, limit-up or
  limit-down exclusions, benchmark comparison, NAV curves, drawdown, IC, and diagnostic
  charts.
quantSkills:
  project_type: skill
  category: tooling
  tags:
  - backtest
  - cross-section
  - long-only
  - diagnostics
  - quant-research
  platforms:
  - claude-code
  - codex
  - openclaw
  - cursor
  status: stable
  validation_level: listed
  maintainer_type: community
  summary_zh: 不是回测框架，而是截面多头回测的标准协议：T+1 开盘成交、Top 等权、双边 15bp、涨跌停剔除、四联诊断图、5 项健康度自检。
  summary_en: Standard cross-sectional long-only backtest protocol with T+1 execution,
    fees, limit filters, NAV curves, IC, drawdown, and diagnostic charts.
  license: GPL-3.0
---

```json qsh-form
{
  "version": 1,
  "task": {
    "placeholder": "补充信号文件、回测区间、基准或特殊假设（可选）"
  },
  "fields": [
    {
      "key": "factor",
      "label": "内置因子",
      "type": "select",
      "default": "momentum_20",
      "help": "填写自定义表达式时以表达式为准",
      "options": [
        { "value": "momentum_20", "label": "20日动量" },
        { "value": "reversal_5", "label": "5日反转" },
        { "value": "lowvol_20", "label": "20日低波动" },
        { "value": "alpha101_101", "label": "Alpha101 #101" },
        { "value": "alpha101_12", "label": "Alpha101 #12" },
        { "value": "corr_open_vol", "label": "量价背离" }
      ]
    },
    {
      "key": "expr",
      "label": "自定义因子表达式",
      "type": "textarea",
      "placeholder": "例如：-1 * correlation(rank(open), rank(volume), 10)"
    },
    {
      "key": "universe",
      "label": "股票池",
      "type": "select",
      "default": "000300.SH",
      "options": [
        { "value": "000300.SH", "label": "沪深300" },
        { "value": "000905.SH", "label": "中证500" },
        { "value": "399006.SZ", "label": "创业板指" },
        { "value": "000852.SH", "label": "中证1000" }
      ]
    },
    {
      "key": "horizon",
      "label": "持有周期",
      "type": "select",
      "default": "5",
      "options": [
        { "value": "1", "label": "1日" },
        { "value": "5", "label": "5日" },
        { "value": "10", "label": "10日" }
      ]
    }
  ],
  "prompt_template": "{{#task}}任务与材料：\n{{task}}\n\n{{/task}}{{#attachments}}用户上传的材料（已放入工作区）：\n{{attachments}}\n\n{{/attachments}}对 {{universe}} 中的因子 {{factor}}{{#expr}}（自定义表达式优先：{{expr}}）{{/expr}} 按 {{horizon}} 日持有周期执行标准截面多头回测，严格采用 T+1 开盘成交、Top 10% 等权、滚动持仓、双边费用、涨跌停与停牌过滤，比较基准并给出净值、回撤、换手、IC、分层收益和健康度诊断，输出中文报告。"
}
```

# Backtest

> 把信号 `[date × symbol]` 模拟交易出来，得到净值 / 回撤 / 换手 / 分组收益。从"统计相关"走向"可执行收益"的关键一步。

## 核心规则

1. **T+1 开盘成交**：T 日收盘后才有信号，**只能用 T+1 开盘买卖**（详见 `references/assumptions.md`）
2. **Top 分位等权**：每日按截面排名取 Top 10%，等权持有
3. **滚动持仓**：H 日重叠，每日 1/H 资金被换仓
4. **涨跌停 / 停牌剔除**：A 股 `trade_status==1` 或 `close >= limit_up*0.99`
5. **双边 15bp**：佣金 + 印花 + 滑点综合估计（美股可降到 5bp）
6. **必出图**：四联或六联诊断图，单看数字会漏信息（详见 `references/diagnostic-charts.md`）
7. **跑完先体检**：5 项健康度自检，再相信结果（详见 `references/health-check.md`）

## 工作流（标准 5 步）

```
1. 校验信号契约（截面规模 / std / 涨跌停字段是否齐）
2. 算 T+1 开盘成交矩阵（mask 涨跌停 / 停牌）
3. 滚动持仓回测（队列 sleeves，每日 1/H 换仓）
4. 算指标（年化 / Sharpe / MDD / 换手）
5. 出四联图 + benchmark 对齐
```

## 接口映射

| 本 skill 概念 | 你的项目对应 |
|---|---|
| `panel` 必须字段 | `open` / `close` / `high` / `low` / `volume` / `trade_status` / `limit_up` / `limit_down` |
| `signal` | `[date × symbol]` 浮点 DataFrame，已截面 z-score |
| `horizon` | 必须等于信号声明的 H |
| 项目内的 `backtest()` | **永远优先调用**，不要自己另写一份"通用版"（破坏评估口径） |

## 按需加载

| 何时读 | 文件 |
|---|---|
| 不确定回测假设是不是合理 | `references/assumptions.md` |
| 想看核心算法骨架 | `references/algorithm.md` |
| 不会画四联图 | `references/diagnostic-charts.md` |
| 跑完想做健康度自检 | `references/health-check.md` |
| 怀疑结果不对劲 | `references/anti-patterns.md` |

## QA 检查清单

- [ ] 信号是 T 日生成、T+1 开盘成交，不是 T 日成交？
- [ ] 涨跌停 / 停牌已剔除？
- [ ] 持仓股数稳定接近 Top X%？（不是 0 也不是 100%）
- [ ] 单日换手 ≈ 2/H（H=5 → ~40%），不是 0% 或 200%？
- [ ] Sharpe ≈ IC_IR × 0.3~0.5，不是 IC_IR × 1.5？
- [ ] 出了四联图（净值 / 累计 IC / 分组收益 / 回撤）？
- [ ] 配了 benchmark 对照？

## 跨工具适配

- OpenAI Codex / Assistants → `agents/openai.yaml`
- Cursor → `agents/cursor-rule.mdc`
- 无原生 skill 机制 → `agents/portable-loader.md`

---

## 项目边界（量化研究合规声明）

> 按 QUANTSKILLS 社区规则 §8 声明。

- **数据来源**：本 skill 不附带任何市场数据；使用者需自行准备行情面板（OHLCV / 涨跌停 / 停牌状态等），数据合法性与许可由使用者负责。
- **假设与参数**：默认假设见各 references（T+1 开盘成交、Top 10% 等权、双边 15bp 手续费、A 股涨跌停规则等）。这些是**研究阶段的标准化假设**，不等同于真实交易。
- **已知限制**：
  - 不模拟市场冲击、不模拟集合竞价滑点、不模拟券池融券约束
  - 不处理分红除权除息 / 配股 / 重大事件停牌的复杂情形
  - 默认 pooled cross-section 范式，对单股序列建模、时序模型不适用
- **风险边界**：本 skill 输出的因子分数 / 回测净值 / IC 诊断结果，**仅反映在历史数据 + 假设条件下的统计表现**，不代表未来表现。
- **用途定位**：**仅供量化研究、教育与方法论参考**。不构成任何形式的投资建议、交易信号或获利保证。使用者据此进行实盘交易的全部后果由使用者自负。
