# PandaAI 数据服务 API 完整列表

> 来源: https://www.pandaai.online/data-service/api-docs
> Python SDK: `import panda_data`

---

## 交易工具

### 交易日历
| 函数 | 说明 |
|------|------|
| `get_trade_cal` | 获取交易日历 |
| `get_prev_trade_date` | 获取指定日期的前第 n 个交易日 |
| `get_last_trade_date` | 获取最新交易日 |
| `get_stock_status_change` | 获取合约特殊处理数据 |
| `get_trade_list` | 获取指定日期的在售股票列表 |

---

## A股数据

### 沪深股票行情数据
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_stock_daily` | 获取A股日线数据 | ⭐⭐⭐⭐⭐ |
| `get_stock_rt_daily` | 获取A股当日日线 | ⭐⭐⭐⭐⭐ |
| `get_stock_daily_pre` | 获取A股前复权日线数据 | ⭐⭐⭐⭐ |
| `get_stock_daily_post` | 获取A股后复权日线数据 | ⭐⭐⭐ |
| `get_stock_min` | 获取A股分钟线 | ⭐⭐⭐⭐⭐ |
| `get_stock_rt_min` | 获取A股当日分钟线 | ⭐⭐⭐⭐ |

### 概念基础数据
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_concept_list` | 获取概念列表 | ⭐⭐⭐⭐ |
| `get_concept_constituents` | 获取概念成分股 | ⭐⭐⭐⭐ |

### 市场参考数据
| 函数 | 说明 |
|------|------|
| `get_stock_detail` | 获取股票基本信息 |
| `get_index_detail` | 获取指数基本信息 |

### 行业基础数据
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_industry_constituents` | 获取行业成分股数据 | ⭐⭐⭐ |
| `get_industry_detail` | 获取行业基本信息数据 | ⭐⭐ |
| `get_stock_industry` | 获取指定股票所属的行业信息 | ⭐⭐⭐⭐ |

### 指数行情（上交所&深交所）
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_index_daily` | 获取指数日线 | ⭐⭐⭐⭐ |
| `get_index_min` | 获取指数分钟线 | ⭐⭐⭐ |

### 指数基础数据
| 函数 | 说明 |
|------|------|
| `get_index_weights` | 获取指数权重信息数据 |
| `get_index_indicator` | 获取指数估值指标数据 |

### 市场交易与资金数据
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_lhb_list` | 获取股票龙虎榜数据 | ⭐⭐⭐⭐⭐ |
| `get_lhb_detail` | 获取股票龙虎榜明细数据 | ⭐⭐⭐⭐⭐ |
| `get_margin` | 获取融资融券信息 | ⭐⭐⭐⭐⭐ |
| `get_hsgt_hold` | 获取沪深股通持股信息 | ⭐⭐⭐⭐⭐ |

### 公司行为
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_investor_activity` | 获取A股合约投资者关系活动 | ⭐⭐⭐ |
| `get_restricted_list` | 获取股票限售解禁明细数据 | ⭐⭐⭐⭐ |
| `get_holder_count` | 获取股东数量 | ⭐⭐⭐ |
| `get_repurchase` | 获取回购数据 | ⭐⭐⭐⭐ |
| `get_top_holders` | 获取A股股东信息 | ⭐⭐⭐ |
| `get_block_trade` | 获取A股大宗交易信息 | ⭐⭐⭐⭐ |
| `get_share_float` | 获取股票股本数据 | ⭐⭐ |
| `get_stock_dividend` | 获取股票分红信息 | ⭐⭐⭐ |
| `get_stock_split` | 获取股票拆分数据 | ⭐⭐ |
| `get_stock_cash_dividend` | 获取股票现金分红数据 | ⭐⭐⭐ |
| `get_stock_dividend_amount` | 获取股票分红总额数据 | ⭐⭐ |
| `get_stock_private_placement` | 获取股票定向增发数据 | ⭐⭐⭐ |
| `get_stock_allotment` | 获取股票配股信息 | ⭐⭐ |

### 股东行为
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_stock_pledge` | 获取A股公司股权质押 | ⭐⭐⭐ |
| `get_stock_pledge_stat` | 获取股票质押信息统计 | ⭐⭐⭐ |
| `get_stock_shareholder_change` | 获取股东增减持计划 | ⭐⭐⭐⭐ |

### 业绩预告
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_fina_forecast` | 获取业绩预告数据 | ⭐⭐⭐⭐⭐ |

### 财务三表、财务快报
| 函数 | 说明 | 与新闻分析的相关性 |
|------|------|:---:|
| `get_fina_performance` | 获取财务快报数据 | ⭐⭐⭐⭐⭐ |
| `get_fina_reports` | 获取财务季度报告 | ⭐⭐⭐⭐ |
| `get_audit_opinion` | 获取财务报告审计意见 | ⭐⭐⭐ |

---

## 期货数据

### 期货行情数据
| 函数 | 说明 |
|------|------|
| `get_future_daily` | 获取期货日线 |
| `get_future_daily_post` | 获取期货后复权数据 |
| `get_future_min` | 获取期货分钟线 |

### 期货基本信息
| 函数 | 说明 |
|------|------|
| `get_future_detail` | 获取期货基本信息 |
| `get_future_dominant` | 获取期货主力合约数据 |

### 期货 DeepView 数据 (20+ 函数)
席位持仓、资金流向、基差、仓单、期限结构、套利、利润等深度数据。

---

## 与新闻情感分析的结合点

### 🔴 核心缺口（当前 skill 没有，PandaAI 有）
1. **`get_stock_daily` / `get_stock_min`** — 股价数据 → 回测新闻信号的胜率
2. **`get_margin`** — 融资融券 → 验证新闻情绪和杠杆资金是否同向
3. **`get_hsgt_hold`** — 北向资金 → 聪明的钱在做什么
4. **`get_lhb_list` / `get_lhb_detail`** — 龙虎榜 → 游资动向
5. **`get_fina_forecast`** — 业绩预告 → 基本面催化剂

### 🟡 增强信号质量的
6. **`get_block_trade`** — 大宗交易（折溢价信号）
7. **`get_repurchase`** — 公司回购（内部人信号）
8. **`get_shareholder_change`** — 股东增减持（内部人信号）
9. **`get_restricted_list`** — 解禁压力

### 🟢 概念/行业辅助
10. **`get_concept_list` + `get_concept_constituents`** — 替代硬编码的板块关键词
11. **`get_stock_industry`** — 自动获取行业分类，比关键词匹配更准
