# panda_data — GNN Stock Graph Skill 使用的 API

以下 API 是本 skill 所依赖的全部数据接口。字段名与参数格式与 `panda_data_api_doc.md` 原文一致。

> **全局约定**
> - 日期格式统一 `YYYYMMDD` 字符串
> - 股票代码带交易所后缀：`.SH` / `.SZ`
> - `panda_data` 为私有包，需 `init_token(username, password)` 后使用
> - 未特别说明的响应表已省略与本 skill 无关的字段

---

## Calendar

### get_last_trade_date
获取最新交易日。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| exchange | Optional[string] | 交易所代码，默认 "SH" | 非必填 |

**响应**: `date` (string, YYYYMMDD)

### get_prev_trade_date
获取指定日期的前第 n 个交易日。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| date | string | 基准日期 YYYYMMDD | 必填 |
| exchange | Optional[string] | 交易所代码 | 非必填 |
| n | Optional[integer] | 前第 n 个交易日，默认 1 | 非必填 |

**响应**: `date` (string)

### get_trade_cal
获取交易日历。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |
| exchange | Optional[string] | 交易所代码 | 非必填 |

**响应**: `date`, `is_trading_day`

---

## Market Data

### get_index_weights
获取指数权重信息。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| index_symbol | string | 指数代码（如 "000300.SH"） | 非必填 |
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |

**响应**: `index_symbol`, `date`, `stock_symbol`, `weight`

### get_factor
获取回测因子（OHLCV + turnover + market_cap）。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |
| factors | list[str] | 因子列表 | 必填 |
| type | Optional[string] | "stock" | 非必填 |
| index_component | Optional[string] | 股票池代码，如 "000300" | 非必填 |

**响应**: `date`, `symbol`, `open`, `close`, `high`, `low`, `volume`, `amount`, `turnover`, `market_cap`

### get_stock_daily_post
获取 A 股后复权日线（pre_close + 涨跌停 + 停牌标记）。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| start_date | string | 开始日期（跨度 ≤ 5 年） | 必填 |
| end_date | string | 结束日期 | 必填 |
| indicator | Optional[string] | 股票池，如 "000300" | 非必填 |
| st | Optional[bool] | 是否含 ST，默认 True | 非必填 |

**响应**: `date`, `symbol`, `name`, `open`, `close`, `high`, `low`, `volume`, `pre_close`, `limit_up`, `limit_down`, `trade_status`

### get_index_daily
获取指数日线。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| symbol | string | 指数代码 | 非必填 |
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |

**响应**: `symbol`, `date`, `open`, `close`, `high`, `low`, `volume`, `pre_close`, `amount`

---

## Graph Relations

### get_industry_constituents
获取申万行业成分股。

**响应**: `industry_code`, `stock_symbol`

### get_concept_constituents
获取概念板块成分股。

**响应**: `concept_code`, `stock_symbol`

### get_stock_industry
获取个股→行业映射。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| symbol | Optional[list[str]] | 股票代码列表 | 非必填 |

**响应**: `symbol`, `industry_code`

---

## Fundamental

### get_fina_reports
获取财务报告（资产负债表/利润表/现金流量表）。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| symbol | list[str] | 股票代码 | 必填 |
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |
| report_type | string | "balance_sheet" / "income" / "cashflow" | 必填 |

**响应**: `date`, `symbol`, `report_type` + 科目字段（中英文列名可能混用）

### get_share_float
获取股本数据。

**响应**: `symbol`, `total_shares`, `float_shares`, `listed_date`

---

## Alternative Data

### get_lhb_list
获取龙虎榜列表。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |

**响应**: `date`, `symbol`, ...

### get_block_trade
获取大宗交易数据。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |

**响应**: `date`, `symbol`, ...

### get_top_holders
获取前十大股东。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| symbol | list[str] | 股票代码 | 必填 |

**响应**: `symbol`, `holder_name`, `holding_ratio`

---

## Filtering

### get_stock_status_change
获取 ST/*ST 等特殊处理状态。

**响应**: `symbol`, `status` / `name`

---

## Macro

### get_macro_na
国民经济核算（GDP 等）。

### get_macro_pi
价格指数（CPI 等）。

### get_macro_ci
景气指数（PMI 等）。

### get_macro_mb
货币与银行（M2 等）。

| 字段 | 类型 | 描述 | 是否必填 |
|:---|:---|:---|:---|
| start_date | string | 开始日期 | 必填 |
| end_date | string | 结束日期 | 必填 |

---

> **注意**：新闻舆情文本无 panda_data 直接接口，需外部 LLM 处理后通过 `--sentiment-file` CSV 注入。
> 供应链关系无直接数据源，v0.1 默认关闭显性供应链边。
