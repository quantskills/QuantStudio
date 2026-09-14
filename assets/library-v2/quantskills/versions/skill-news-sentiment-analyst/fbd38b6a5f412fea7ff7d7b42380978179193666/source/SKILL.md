---
name: news-sentiment-analyst
description: A-share financial news analyst. Collects news from 3 sources (Eastmoney/Futu/Tonghuashun), analyzes each news to identify affected stocks/sectors using AI knowledge, cross-validates with PandaAI real-time price/volume/amplitude/margin/industry data. Outputs investment bank-style terminal report + Parquet. Use when user asks to analyze A-share news, understand what stocks are affected by today's news, or get a structured market overview.
---

# News Sentiment Analyst

A 股财经新闻分析 — 采集 → AI 分析(自主识别股票) → PandaAI 多维度验证 → 投行级报告

## 工具定位
- **核心能力**：多源财经新闻采集 + AI 自主分析（识别受影响股票/板块/情感）+ PandaAI 多维度实时数据验证（OHLCV/振幅/成交额/融资变化/行业）
- **关键差异**：不依赖正则/关键词提取股票代码，AI 用自己的知识判断新闻影响哪些股票；报告基于实际数据动态生成分析结论，无硬编码文字
- **输出**：rich 投行风格终端报告（5 个 Section）+ Parquet 结构化文件（含增强验证数据）

## 何时使用

- 用户要求分析今日 A 股新闻及其对市场的影响
- 用户想知道某条新闻具体影响哪些股票
- 用户想了解当日市场热点板块和情绪
- Alpha 或 agent 需要结构化新闻分析数据

## 执行步骤

当你触发此 skill 时，严格按以下步骤执行：

### 第〇步：检查 PandaAI 配置

```bash
if [ ! -f .env ]; then
  echo "PandaAI 未配置。"
  echo "配置后可以获取实时股价、振幅、成交额、融资方向、行业分类等数据来验证分析。"
  echo "请在 .env 文件中填入:"
  echo "  PANDA_DATA_USERNAME=86手机号"
  echo "  PANDA_DATA_PASSWORD=密码"
fi
```

> 用户拒绝配置时跳过验证步骤，核心新闻分析不受影响。

### 第一步：采集新闻 + 市场背景

```bash
python scripts/collector.py --date $(date +%Y-%m-%d) --max-news 30 --output /tmp/collector_output.json
```

读取输出的 JSON，获取新闻列表和市场背景数据（板块涨幅 TOP5、北向资金等）。

### 第二步：AI 逐条分析新闻（核心步骤）

对每条新闻，**你作为 A 股分析师**，自主分析：

1. **核心事件**：新闻说了什么？事实还是传闻？
2. **受影响股票**：用你的知识判断哪些 A 股会受影响
   - 新闻提到公司名 → 对应 A 股代码
   - 新闻影响板块但没提公司 → 列举代表性股票
   - 宏观政策 → 判断受益/受损行业及代表股票
3. **受影响板块**：哪些行业/概念板块
4. **情感判断**：正面/负面/中性
5. **因果推理**：一句话说明为什么

输出格式（每条新闻一个对象，保存为 JSON 数组）：

```json
{
  "news_title": "新闻原标题",
  "affected_stocks": [
    {"name": "股票名称", "code": "300750", "impact": "positive", "reason": "简短原因"}
  ],
  "affected_sectors": ["新能源"],
  "sentiment": "positive",
  "reasoning": "一句话因果推理"
}
```

> 股票代码必须是 6 位数字，不确定时留空，不要猜测。

分析完毕后保存 JSON：

```bash
cat > /tmp/analysis_output.json << 'EOF'
[
  {"news_title":"...", "affected_stocks":[...], "affected_sectors":[...], "sentiment":"...", "reasoning":"..."}
]
EOF
```

### 第三步：PandaAI 多维度验证

收集所有涉及股票代码。如果列表不为空且有 PandaAI 配置：

```bash
python scripts/verifier.py --codes 300750,600519 --date $(date +%Y-%m-%d) --output /tmp/verify_output.json
```

验证器返回每只股票的增强数据：
- **价格**：开盘价、最高价、最低价、收盘价、前收盘价、涨跌停价
- **涨跌幅**：当日涨跌幅、5日涨跌幅
- **振幅**：(最高-最低)/前收盘
- **成交**：成交量(股)、成交额(元)、成交额(亿元)
- **融资**：融资方向(up/down)、融资余额变化率
- **行业**：所属行业分类
- **股票名称**

### 第四步：生成投行级报告

```bash
python scripts/reporter.py \
  --analysis /tmp/analysis_output.json \
  --verify /tmp/verify_output.json \
  --market /tmp/collector_output.json \
  --trade-date $(date +%Y-%m-%d) \
  --output-dir output
```

报告包含 5 个 Section + 情绪总览：

| Section | 内容 |
|---------|------|
| **Section I** | 执行摘要 — 新闻覆盖、股票数量、情绪分布、活跃板块 |
| **Section II** | 市场概况 — 指数、北向资金、板块涨幅 TOP5 |
| **Section III** | 主题分析 — 按主题分组（地缘/科技/政策/资金等），逐条标注情绪、关联股票及PandaAI实时数据 |
| **Section IV** | 股票数据面板 — 9 列表格（代码/名称/行业/收盘/涨跌幅/振幅/成交额/融资变化/5日涨跌/分析观点） |
| **Section V** | 核心观察 — 基于实际数据动态生成（涨跌幅极端值/高波动标的/成交集中度/预期偏差/融资情绪/板块强弱），**无硬编码结论** |
| **Sentiment** | 情绪总览 — 正面/负面/中性比例 |

> 报告所有观察结论均通过 `_compute_observations()` 函数基于实际数据计算，每日自动适配当天数据特征。

### 第五步：向用户展示

将 reporter 生成的报告展示给用户，附上关键发现。

## 输出文件

- `output/news_analysis_YYYY-MM-DD.parquet` — 结构化分析数据（含增强 PandaAI 验证字段）
- 终端报告直接展示给用户

## 参数说明

### collector.py

| 参数 | 默认值 | 说明 |
|------|--------|------|
| --date | 今天 | 交易日期 |
| --max-news | 30 | 最大分析条数 |
| --news-type | all | macro / company / all |

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
| --no-rich | 禁用 rich 格式 |

## Parquet 增强字段

| 字段 | 说明 |
|------|------|
| price_1d | 当日涨跌幅(%) |
| price_5d | 5日涨跌幅(%) |
| close/open/high/low | OHLCV 价格 |
| amplitude | 振幅(%, (high-low)/pre_close) |
| volume | 成交量(股) |
| amount / amount_b | 成交额(元/亿元) |
| num_trades | 成交笔数 |
| margin | 融资方向(up/down) |
| margin_change_pct | 融资余额变化率(%) |
| industry | 行业分类 |
| stock_name | 股票名称 |

## 注意事项

- AI 自主识别股票代码基于你的知识，不确定时留空
- PandaAI 为可选项，未配置时跳过验证步骤
- 新闻为实时快照，不含历史数据
- `.env` 文件已 gitignore
