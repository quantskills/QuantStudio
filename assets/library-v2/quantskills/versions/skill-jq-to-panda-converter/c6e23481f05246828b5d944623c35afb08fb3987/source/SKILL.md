---
name: jq-to-panda-converter
description: "Migrate quantitative trading strategies from JoinQuant (聚宽) platform to PandaAI (盘达) platform by understanding the strategy logic and rewriting it into PandaAI's JSON-based trading system. Use when an agent needs to convert JoinQuant strategies (Python, jqdata SDK) to PandaAI's strategy format while preserving the original trading logic, signal construction, and execution rules. Supports single files and batch directory conversion."
quantSkills:
  organization: https://github.com/quantskills
  repository: quantskills/skill-jq-to-panda-converter
  repository_url: https://github.com/quantskills/skill-jq-to-panda-converter
  project_type: skill
  collection: strategy-tools
  license: GPL-3.0
  category: tooling
  tags: [joinquant, jqdata, pandaAI, strategy-migration, strategy-conversion, code-translation, backtesting, batch]
  platforms: [claude-code, codex, openclaw]
  language: zh-en
  status: draft
  validation_level: listed
  maintainer_type: community
  requires: []
  summary_zh: 将聚宽(JoinQuant)平台策略代码批量转换为PandaAI平台支持的策略代码，理解策略思想而非逐行翻译，支持单文件转换和批量目录转换
  summary_en: Batch convert JoinQuant platform strategies to PandaAI-compatible code. Understands strategy intent rather than line-by-line translation, supports single file and batch directory conversion, produces runnable backtest configs with a summary report.
---

```json qsh-form
{
  "version": 1,
  "task": {
    "placeholder": "请说明要转换的 JoinQuant 源文件、目录或文件清单，以及期望的输出位置",
    "required": true
  },
  "prompt_template": "{{#task}}任务与材料：\n{{task}}\n\n{{/task}}{{#attachments}}用户上传的材料（已放入工作区）：\n{{attachments}}\n\n{{/attachments}}请读取并理解 JoinQuant 策略的信号、交易规则、调度、股票池与仓位逻辑，按策略类型选择 PandaAI Format A 或 Format B 做语义迁移；支持单文件或批量目录，验证信号与执行等价性，生成有效策略 JSON 和转换产物，输出中文报告。"
}
```

# JoinQuant → PandaAI Strategy Converter

Use this skill to migrate quantitative trading strategies from the JoinQuant (聚宽) platform to the PandaAI (盘达) platform. The conversion is **semantic** — it understands the original strategy's intent, signal logic, and trading rules, then rewrites them into PandaAI's configuration-driven format.

## Strategy Classification System

Before converting, classify each JQ strategy into one of these **pattern types**. This decision determines the output format and the template used:

| Type | ID | Characteristics | PandaAI Output Format | Example |
|------|-----|----------------|----------------------|---------|
| **Simple MA/Timing** | `simple_ma` | Single stock/ETF, `attribute_history` + MA conditions, `order_value`/`order_target` | **Format B** (JSON config `trade_template`) | MA5/MA20 crossover |
| **Multi-stock factor fund** | `factor_fund` | `get_fundamentals(query(...))` + factor filtering, multi-stock, `run_monthly`/`run_weekly` | **Format B** (factor pre-loaded in `strategy_content`) | PEG stock selection |
| **Complex stat/ML model** | `stat_model` | OLS regression, stateful computation (`g.betas`, `g.high`/`g.low`), multi-step signal | **Format A** (code_blocks) | ETF timing Z-score |
| **Futures strategy** | `futures` | `set_subportfolios`, `set_order_cost` for futures, `get_price` for futures contracts, `g.multiplier` | **Format A** (code_blocks) | Commodity futures |
| **Custom stock pool** | `custom_pool` | Dynamic stock selection via `get_index_stocks()` + `get_fundamentals()` filter + scoring | **Format A** (code_blocks) | Quant stock selection |
| **Unknown / unclassified** | `fallback` | Cannot easily classify; still attempt semantic conversion but output Format A | Decision based on complexity | Any |

The classification is made by scanning the JQ source for these **pattern signatures**:

- **`sm.OLS`**, **`sm.add_constant`**, **`statsmodels`** → `stat_model`
- **`get_fundamentals`** + **`order_target_value`** (multi-stock) → `factor_fund`
- **`set_subportfolios`**, **`futures_margin_rate`**, **`get_price(contract, ...)`** → `futures`
- **`get_index_stocks`** + filter logic → `custom_pool`
- **`run_daily`** + single stock + `attribute_history` + MA → `simple_ma`
- Default: `fallback`

## Batch Conversion Mode

This skill supports **three conversion modes**:

| Mode | Trigger | Use When |
|------|---------|----------|
| **Single file** | User provides one .py file | One strategy to convert |
| **Batch directory** | User provides a directory path with .py files | Multiple JQ strategies in a folder |
| **Mixed (specified list)** | User lists specific files | Selected strategies from different locations |

**Batch mode output**: A single `conversion_summary.md` plus individual files, or one combined `panda_strategies.json` containing all converted strategies in PandaAI's array format.

For batch conversion, the skill:
1. Scans the directory for JoinQuant Python strategy files (.py)
2. Reads and classifies each strategy by **pattern type** (see Strategy Classification below)
3. Converts each independently using the Core Workflow
4. Produces a **summary report** and **individual outputs**

## Core Philosophy

**This is NOT a line-by-line code translator.**

JoinQuant and PandaAI both use Python function-based paradigms (`initialize`, `handle_data`), but their APIs differ significantly:

| Dimension | JoinQuant (聚宽) | PandaAI (盘达) |
|-----------|-----------------|----------------|
| Strategy format | `initialize → handle_data/data` + `run_daily/run_weekly/run_monthly` | `initialize → handle_data/data` + `after_trading` (all in `code_blocks[].code`) |
| Account/Portfolio | `context.portfolio.positions`, `context.portfolio.available_cash` | `context.stock_account_dict.get(account)`, `stock_account.positions`, `stock_account.total_value` |
| Order execution | `order(s, amt)`, `order_value(s, val)`, `order_target(s, 0)`, `order_target_value(s, val)` | `order_shares(account, symbol, shares, style=MarketOrderStyle)` |
| Data fetching (market) | `attribute_history(s, cnt, '1d', fields)`, `get_price(s, ...)`, `get_bars(s, cnt, '1d', fields)` | `panda_data.get_market_data(symbol=..., start_date=..., end_date=..., type='stock', fields=['close','high','low'])` |
| Data fetching (factors) | `get_fundamentals(query(...))` | `panda_data.get_factor(start_date, end_date, symbol, factors=[...], type='stock')` |
| Stock universe | `get_index_stocks('000300.XSHG')`, `get_industry_stocks()` | `panda_data.get_stock_detail(symbol='', fields=['symbol'], market='cn', status=1)` |
| Trading calendar | `get_all_trade_days()` | `panda_data.get_trading_calendar(start_date, end_date)` |
| Global state | `g.variable`, `context.variable` | `context.variable` (same, no `g.` object) |
| Scheduling | `run_daily(f, time)`, `run_weekly(f, day, time)`, `run_monthly(f, day, time)` | `handle_data(context, data)` runs every bar; use `context.run_day` or `context.now` to control timing |
| Current bar data | `data[symbol].close`, `data[symbol].high`, `data[symbol].low` | `data[symbol].close` — same! |
| Logging | `log.info(...)`, `record(...)` | `print(...)` for logging |
| Commission | `set_order_cost(OrderCost(...))` | Platform default; not usually configured in code |

**The converter works at the logic level:**
1. Read and understand the JQ strategy's **trading logic** (what conditions trigger buys/sells)
2. Understand the **signal computation** (how the strategy derives its signals)
3. Map the **execution timing** (when does the strategy make decisions)
4. Map the **stock universe** (which stocks does it trade)
5. Rebuild everything in PandaAI's `code_blocks[].code` format (Python with `initialize/handle_data`, NOT the JSON config format)

## Core Workflow

### Phase 0: (Batch Mode Only) — Scan & Classify

Given a directory of JQ strategy files:

1. **Discover files**: Find all `.py` files in the directory (recursive scan)
2. **Quick-scan each file**: Read imports, top-level function names, key API usage patterns
3. **Classify** each strategy using the Strategy Classification System above
4. **Group by pattern type** — strategies of the same type share conversion templates
5. **Detect dependencies** — check if any strategy references another (e.g., utility module)
6. **Produce a batch plan**:

```
Input:  Desktop/聚宽案例/ (18 files)
Plan:
  simple_ma:  38098.py, 38102.py, 38131.py
  factor_fund: 38088.py, 38099.py, 38101.py
  stat_model: 38103.py, 38121.py
  futures:    38081.py, 38105.py
  custom_pool: 38087.py, 38104.py, 38112.py, 38114.py, 38115.py, 38118.py, 38132.py, 38135.py
  fallback:   38104.py
Total: 18 files → 18 PandaAI strategies
```

### Phase 1: Parse JoinQuant Strategy (per file)

Analyze the JQ strategy file for these components (see `references/jq_patterns.md` for exhaustive coverage):

| Component | JQ Pattern | Example |
|-----------|-----------|---------|
| **Initialization** | `def initialize(context):` | Set benchmark, options, global vars |
| **Global state** | `g.stock = '000001.XSHE'` | Global variables via `g.` object |
| **Trading function** | `def handle_data(context, data):` or `run_daily(func, time='...')` | Main strategy logic |
| **Stock universe** | `get_index_stocks('000300.XSHG')`, `get_industry_stocks()` | Candidate stocks |
| **Market data** | `attribute_history(s, n, '1d', ['close','high','low'])`, `get_price()`, `history()` | Historical price/volume |
| **Fundamental data** | `get_fundamentals(query(...))` | Financial indicators |
| **Signal logic** | `if current_price > MA5 * 1.01:` | Buy/sell conditions |
| **Order execution** | `order(s, 1000)`, `order_value(s, cash)`, `order_target(s, 0)` | Trade placement |
| **Scheduling** | `run_daily(f, 'every_bar')`, `run_weekly(f, 1, '9:30')` | When to run |
| **Benchmark** | `set_benchmark('000300.XSHG')` | Benchmark index |
| **Options** | `set_option('use_real_price', True)` | Platform config |
| **Logging** | `log.info(...)`, `record(...)` | Debug/record variables |

### Phase 2: Understand Strategy Intent

Before writing any PandaAI code, document:

1. **What signal drives the strategy?** (Moving average crossover? Factor rank? Momentum? Mean-reversion?)
2. **What is the entry/exit condition?** (e.g., price > MA5 → buy; price < MA5 → sell)
3. **What is the position sizing?** (Fixed shares? % of cash? Target weight?)
4. **What is the rebalance schedule?** (Every bar? Weekly on Monday? Monthly on 1st trading day?)
5. **What is the tradable universe?** (Index constituents, filtered by fundamentals?)

### Phase 3: Generate PandaAI Strategy Code

PandaAI strategies support TWO formats. **Choose the right one based on the strategy complexity**:

#### Format A: `code_blocks[].code` (Python function-based — SIMILAR to JQ)

**Best for**: Complex strategies with multiple schedules, stateful logic, OLS/statistical models, dynamic stock universe, conditional trading rules.

**Structure**:
```json
{
  "index": 0,
  "name": "Strategy_Name",
  "description": "...",
  "workflow_type": ["stock_backtest"],
  "code_blocks": [
    {
      "node_title": "Python交易代码",
      "code_lines": 200,
      "code": "from panda_backtest.api.api import *\nfrom panda_backtest.api.stock_api import *\nimport panda_data\n...\n"
    }
  ]
}

This format uses:
- `def initialize(context):` — Set up stocks, parameters, preload data
- `def handle_data(context, data):` — Main logic (runs every bar)
- `def after_trading(context):` — Post-market summary
- `order_shares(account, symbol, shares, style=MarketOrderStyle)` — Place orders
- `context.stock_account_dict.get(account)` — Access account/portfolio info
- `stock_account.positions` — Dict of positions keyed by symbol
- `panda_data.get_market_data(...)` — Market/K-line data
- `panda_data.get_factor(...)` — Factor/fundamental data
- `panda_data.get_stock_detail(...)` — Stock universe
- `panda_data.get_trading_calendar(...)` — Trading calendar

> **完整的 PandaAI API 参考**（生命周期函数、对象模型、交易函数、数据API、MODE 模板、注意事项）详见 `references/panda_framework.md`
```

#### Format B: JSON config with `strategy_content` + `trade_template` (Declarative)

**Best for**: Simple single-stock strategies, clear signal conditions, fixed stock universe.

```json
{
  "strategy_name": "...",
  "stockpool_type": "custom",
  "stockpool_stock": ["000001.XSHE"],
  "freq_type": "every_bar",
  "trade_template": [
    { "type": "buy", "condition": "...", "amount": 0.95, "price": 0, "pro_code": "000001.XSHE" }
  ],
  "strategy_content": "import pandas as pd\n... signal computation ...\n",
  "keep": "{}"
}
```

**With Format B, the JSON fields are set via the PandaAI platform UI or API; the Python code goes into `strategy_content`.**

### Phase 4: Verify the Output

After generating the PandaAI config, verify:

1. **Signal correctness** — Does the signal logic produce the same decision given the same inputs?
2. **Execution timing** — Is the schedule equivalent (`handle_data` runs every bar)?
3. **Stock universe** — Does the strategy trade the same set of stocks?
4. **Position sizing** — Are order amounts equivalent?
5. **Run a quick backtest** — Is the config valid for PandaAI's backtest engine?

## Output Contract

### Single File Mode

Produce:

- **`strategy_config.json`** — Valid PandaAI JSON strategy configuration (code_blocks format for complex, or config format for simple)
- **`conversion_report.md`** — Document showing:
  - Original JQ strategy overview
  - Complete API mapping (which JQ API → which PandaAI API)
  - Signal logic explanation
  - Differences / caveats (if any features cannot be exactly replicated)
  - Verification checklist
  - Complete converted Python code

### Batch Directory Mode

Produce a **single output directory** (e.g., `panda_output/`) containing:

```
panda_output/
├── panda_strategies.json          ← Combined PandaAI JSON (array of all converted strategies)
│                                    Can be used for bulk import into PandaAI platform
├── conversion_summary.md           ← Master report comparing all strategies
│                                     ├── Strategy classification table
│                                     ├── API usage heatmap
│                                     ├── Conversion difficulty ratings
│                                     ├── Pattern distribution summary
│                                     └── Warnings & caveats
├── strategies/                     ← Individual files for each converted strategy
│   ├── 38081_futures_multi.json
│   ├── 38088_peg_selection.json
│   ├── 38131_ma_crossover.json
│   └── ...
└── reports/                        ← Individual conversion reports
    ├── 38081_conversion_report.md
    ├── 38088_conversion_report.md
    └── ...
```

The `conversion_summary.md` should include a summary table like:

| File | Title | Type | Difficulty | Status | Key Diffs |
|------|-------|------|-----------|--------|-----------|
| 38081.py | 商品期货多策略复合 | futures | ⭐⭐⭐ | ✅ | Futures orders not supported |
| 38088.py | PEG选股 | factor_fund | ⭐⭐ | ✅ | stockpool needs static list |
| 38131.py | 择时策略 | simple_ma | ⭐ | ✅ | Exact match |

## References

| File | When to read |
|------|-------------|
| `references/jq_patterns.md` | When parsing ANY JoinQuant strategy — exhaustive API mapping table |
| `references/panda_format.md` | When generating PandaAI strategy JSON — full format specification |
| `references/panda_framework.md` | When writing PandaAI Python code — complete API reference: lifecycle functions, object model, trading APIs, data APIs, MODE mode template, and constraints |
| `references/step_by_step_guide.md` | When you need a concrete walkthrough with a real conversion example |
| `references/source_boundary.md` | When deciding which data/concepts are in scope |
| `references/batch_conversion.md` | When doing batch / directory conversion (classification rules, output layout, combined JSON format, summary report template) |

## Examples

| File | Description |
|------|-------------|
| `examples/ma_crossover_jq.py` | JoinQuant 5/20 MA crossover strategy (original — Format A, single stock) |
| `examples/ma_crossover_panda.json` | Converted PandaAI configuration (Format B — simple single-stock) |
| `examples/conversion_report.md` | Full conversion report for the MA crossover example |
| `examples/etf_timing_conversion_report.md` | Full conversion of a complex JQ ETF timing + stop-loss strategy (Format A — `code_blocks`) |
| `examples/etf_timing_panda.json` | Converted PandaAI code_blocks JSON (Format A) |

## Agents

| File | Platform |
|------|----------|
| `agents/openai.yaml` | OpenAI / Claude Code entrypoint |

## Constraints

| Constraint | Description |
|---|---|
| 🌐 聚宽专有API限制 | 聚宽的`get_fundamentals(query(...))`、`get_extra_info()`、`get_call_auction()`、`get_mtss()`、`get_billboard_list()`等一些特有数据API在PandaAI中无直接等价功能。PandaAI的数据获取通过`panda_data.get_market_data()`、`panda_data.get_factor()`等API实现。复杂SQL查询需转换为PandaAI可用的形式|
| 🚫 调度语义差异 | 聚宽的`run_daily(func, 'every_bar')` / `run_weekly` / `run_monthly`在PandaAI中无等价函数。PandaAI使用`handle_data(context, data)`作为唯一的每Bar入口。通过手动判断`context.now`或`context.run_day`实现定时逻辑 |
| ⚠️ 信号语义优先 | 优先确保交易信号条件等效。**关键是信号逻辑本身**（如MA5 > MA20通道、OLS回归Z值），而不是API语法的精确匹配 |
| 📋 回测参数一致 | PandaAI的`code_blocks`格式中回测参数（start_date、end_date、init_cash）通常在平台UI设置，不在代码中。需确保平台设置与原JQ回测参数一致 |
| 🔄 状态变量迁移 | 聚宽`g.`全局对象 → PandaAI的`context.`变量（`context.variable = value`），不需要`g.`前缀。持仓状态通过`stock_account.positions`访问 |
