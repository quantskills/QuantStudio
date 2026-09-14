# 📰 News Sentiment Analyst

A 股财经新闻分析 Skill — 采集 → AI 自主分析 → PandaAI 多维度验证 → 投行级报告

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://www.python.org/)
[![akshare](https://img.shields.io/badge/akshare-latest-green)](https://github.com/akfamily/akshare)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE.txt)

---

## 🎯 核心能力

```
 东方财富(200)                        ┌──────────────────────┐
 富途牛牛(50)       ──→  AI 分析 ──→  │  投行级终端报告      │  ──→  向用户展示
 同花顺(20)            (自主识别股票)   │  5 Section 结构      │
                                      │  Parquet 持久化      │
                                      └──────┬───────────────┘
                                             │
                                    ┌────────▼────────────────┐
                                    │  PandaAI 多维度验证      │
                                    │  OHLCV/振幅/成交额/融资   │
                                    │  行业/5日涨跌/融资变化率  │
                                    └─────────────────────────┘
```

**关键差异**：
- 不依赖正则/关键词提取股票代码，AI 用自己的知识判断新闻影响哪些股票
- 报告基于实际数据动态生成分析结论，**无硬编码文字**
- 投行级报告风格：执行摘要 → 市场概况 → 主题分析 → 股票面板 → 核心观察

## 🚀 快速开始

### 安装

```bash
pip install -r requirements.txt
```

### 使用（AI Agent 自动执行）

触发 skill 后，AI 会自动执行 5 步流程：

```bash
# Step 1: 采集新闻
python scripts/collector.py --date $(date +%Y-%m-%d) --max-news 30 --output /tmp/news.json

# Step 2: AI 逐条分析新闻（AI 自主识别股票代码/板块/情感）
# 输出保存到 /tmp/analysis.json

# Step 3: PandaAI 多维度验证
python scripts/verifier.py --codes 300750,600519 --date $(date +%Y-%m-%d) --output /tmp/verify.json

# Step 4: 生成投行级报告
python scripts/reporter.py --analysis /tmp/analysis.json --verify /tmp/verify.json --market /tmp/news.json --output-dir output

# Step 5: 展示给用户
```

### 直接使用脚本

```bash
# 采集今日新闻
python scripts/collector.py

# 验证特定股票
python scripts/verifier.py --codes 300750,600519 --date 2026-07-09

# 生成报告
python scripts/reporter.py --analysis /tmp/analysis.json --verify /tmp/verify.json --market /tmp/news.json --trade-date 2026-07-09
```

## 🏗️ 架构

```
scripts/
├── collector.py     ← 新闻采集（AKShare 3源并行 + 去重 + 市场背景）
├── verifier.py      ← PandaAI 多维度验证（OHLCV/振幅/成交额/融资变化率/行业）
├── reporter.py      ← 投行级报告生成（rich 终端 + Parquet，动态观察引擎）
└── output/          ← Parquet 输出目录
```

### 数据流

```
collector.py  ──→  AI Agent(LLM)  ──→  verifier.py  ──→  reporter.py
  │                  │                  │                │
  ▼                  ▼                  ▼                ▼
 新闻JSON         自主识别股票         PandaAI多维度     动态观察引擎
 市场背景         情感判断             验证数据         投行级报告
 板块TOP5                             36个字段         Parquet持久化
```

## 📦 报告结构

### 终端报告（rich 彩色表格，投行风格）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NEWS SENTIMENT ANALYST  |  DAILY BRIEF  |  2026-07-09  |  2026-07-09 11:14
  Analyst: AI Research Analyst, Sisyphus Alpha  |  Source: PandaAI · EastMoney · THS · Futu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section I: Executive Summary / 执行摘要
  ┌──────────────────┬──────────────────────────────────────────────────┐
  │ 新闻覆盖         │ 27 条                                            │
  │ 涉及股票         │ 36 只                                            │
  │ 情绪分布         │ 正面 14(52%)  负面 10(37%)  中性 3(11%)          │
  │ 活跃板块（新闻） │ 保险(3次)、半导体(3次)、石油石化(2次)              │
  └──────────────────┴──────────────────────────────────────────────────┘

Section II: Market Context / 市场概况
  ┌──────────────────┬──────────────────────────────────────────────────┐
  │ 板块涨幅 TOP5    │ 油气及炼化 +5.74%                                │
  │                  │ 文字媒体 +5.19%                                   │
  │                  │ 油服工程 +4.49%                                   │
  │                  │ 半导体材料 +4.16%                                 │
  │                  │ 油田服务 +3.56%                                   │
  └──────────────────┴──────────────────────────────────────────────────┘

Section III: Thematic Analysis / 主题分析
  ▎科技/半导体 (6条)
    🟢 半导体材料板块持续走强，上海合晶20cm涨停
      板块: 半导体材料, 半导体设备
      ▲ 上海合晶(688584)  +12.77%  振幅18.8%  成交10.2亿  融资↓  电子
        → 涨停20cm，资金追捧半导体材料
      ▲ 中芯国际(688981)  +10.91%  振幅8.2%  成交114.9亿  融资↓  电子
      ...

Section IV: Stock Dashboard / 股票数据面板
  ┌──────┬────────┬────────┬──────┬────────┬──────┬──────┬──────┬──────────┬──────────────────────┐
  │ 代码 │ 名称   │ 行业   │ 收盘 │ 涨跌幅 │ 振幅 │ 成交额│ 融资 │ 5日涨跌  │ 分析观点             │
  ├──────┼────────┼────────┼──────┼────────┼──────┼──────┼──────┼──────────┼──────────────────────┤
  │000977│浪潮信息│ 计算机 │ 85.99│+21.01% │ 5.6% │181.0 │↓-8.8│ -18.40%  │ 国产算力龙头...      │
  │002057│中钢天源│社会服务│  9.70│-19.03% │ 9.3% │  4.5 │↓-1.2│ +18.00%  │ 触及跌停...          │
  │688584│上海合晶│ 电子   │ 40.27│+12.77% │18.8% │ 10.2 │↓-12.9│ +5.72%   │ 涨停20cm...          │
  └──────┴────────┴────────┴──────┴────────┴──────┴──────┴──────┴──────────┴──────────────────────┘

Section V: Key Observations / 核心观察（由动态引擎基于实际数据计算）
  [1] 涨幅居前: 浪潮信息(+21.01%)、华虹宏力(+18.86%)、上海合晶(+12.77%)
  [2] 跌幅居前: 中钢天源(-19.03%)、天齐锂业(-18.26%)、永兴材料(-16.66%)
  [3] 高波动标的: 上海合晶(振幅18.82%)、华虹宏力(振幅14.18%)、华天科技(振幅10.58%)
  [4] 预期偏差: 招商南油(-2.90%) 分析看多但实际大跌
  [5] 融资资金偏向谨慎（23只融资下降 vs 13只上升）
  [6] 板块强弱: 有色金属整体偏弱(均值-13.03%)

Sentiment Summary / 情绪总览
  ┌──────────┬────────┬────────┐
  │ 情绪     │ 新闻数 │ 占比   │
  ├──────────┼────────┼────────┤
  │ 🟢 正面  │   14   │  52%   │
  │ 🔴 负面  │   10   │  37%   │
  │ ⚪ 中性  │    3   │  11%   │
  └──────────┴────────┴────────┘
```

### Parquet 字段

| 字段 | 说明 |
|------|------|
| trade_date | 交易日期 |
| build_id / build_name | 构建标识 |
| result_type | news_analysis |
| result_json | 完整分析（含增强验证数据） |
| data_version | 3.0.0 |
| update_time | 时间戳 |

`result_json` 内嵌的增强字段：

| 字段 | 说明 |
|------|------|
| price_1d | 当日涨跌幅(%) |
| price_5d | 5日涨跌幅(%) |
| close / open / high / low | OHLCV |
| amplitude | 振幅(%, (high-low)/pre_close) |
| volume | 成交量(股) |
| amount / amount_b | 成交额(元/亿元) |
| num_trades | 成交笔数 |
| margin | 融资方向(up/down) |
| margin_change_pct | 融资余额变化率(%) |
| industry | 行业分类 |
| stock_name | 股票名称 |

## ⚙️ 参数

### collector.py

| 参数 | 默认值 | 说明 |
|------|--------|------|
| --date | 今天 | 交易日期 |
| --max-news | 50 | 最大条数 |
| --news-type | all | macro / company / all |
| --output | stdout | JSON 输出路径 |

### verifier.py

| 参数 | 说明 |
|------|------|
| --codes | 股票代码逗号分隔, 如 300750,600519 |
| --date | 交易日期 |
| --output | JSON 输出路径 |

### reporter.py

| 参数 | 说明 |
|------|------|
| --analysis | AI 分析 JSON 路径 |
| --verify | PandaAI 验证 JSON 路径 |
| --market | 市场背景 JSON 路径 |
| --trade-date | 交易日期 |
| --output-dir | Parquet 输出目录 |
| --no-rich | 禁用 rich 格式(纯文本 fallback) |

## 🔌 PandaAI 配置

```bash
cp .env.example .env
# 编辑 .env:
#   PANDA_DATA_USERNAME=86手机号
#   PANDA_DATA_PASSWORD=密码
```

验证器使用 PandaAI 的以下数据源：

| API | 数据 |
|-----|------|
| `get_stock_rt_daily` | 当日实时 OHLCV、成交量、成交额、成交笔数 |
| `get_market_data` | 前收盘价、涨跌停价、股票名称 |
| `get_stock_daily` | 历史收盘价(用于计算5日涨跌) |
| `get_margin` | 融资余额(方向 + 变化率) |
| `get_stock_industry` | 行业分类 |

> Elite 套餐(¥153/月)含融资融券+北向资金+龙虎榜+财务数据。
> 未配置时跳过验证步骤，核心分析不受影响。

## 🧠 动态观察引擎

`reporter.py` 的 `_compute_observations()` 函数基于实际数据实时计算 8 类观察：

1. **涨跌幅极端值** — 当日涨幅/跌幅 TOP3
2. **高波动标的** — 振幅 > 8% 的股票
3. **成交额集中度** — 资金扎堆方向
4. **预期偏差** — AI分析方向 vs 实际走势背离 > 2%
5. **融资情绪** — 杠杆资金整体方向（↑/↓占比）
6. **融资异动** — 融资余额变化率极端值
7. **板块聚焦** — 新闻提及最多的板块
8. **板块强弱** — 同行业股票平均涨跌

所有观察无硬编码，每天基于当天数据自动生成。

## 📄 许可证

Apache 2.0
