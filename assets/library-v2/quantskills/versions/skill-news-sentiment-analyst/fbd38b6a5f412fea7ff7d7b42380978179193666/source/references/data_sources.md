# 数据源说明

## AKShare

本项目使用 [AKShare](https://github.com/akfamily/akshare) 作为唯一数据源。AKShare 是国内最主流的开源 A 股数据接口库，完全免费，无需注册。

### 安装

```bash
pip install akshare>=1.10.0
```

### 新闻接口

| 接口 | 来源 | 条数 | 返回字段 |
|------|------|:----:|----------|
| `ak.stock_info_global_em()` | 东方财富全球快讯 | 200 | 标题/摘要/发布时间/链接 |
| `ak.stock_info_global_futu()` | 富途牛牛快讯 | 50 | 标题/内容/发布时间/链接 |
| `ak.stock_info_global_ths()` | 同花顺全球直播 | 20 | 标题/内容/发布时间/链接 |
| `ak.stock_news_em(symbol)` | 东方财富个股新闻 | 20 | 新闻标题/新闻内容/发布时间/文章来源 |

> :warning: `stock_news_em(symbol)` 用于获取**特定股票**的新闻，`symbol` 参数为股票代码（如 `"000001"`），不是关键词。

### 辅助接口

| 接口 | 功能 |
|------|------|
| `ak.stock_info_a_code_name()` | A 股股票名称→代码映射（5500+只） |

### 使用示例

```python
import akshare as ak

# 获取全球快讯（东方财富）
news = ak.stock_info_global_em()
print(news.head())

# 获取特定股票新闻
stock_news = ak.stock_news_em(symbol="000001")
print(stock_news.head())

# 获取股票名称映射
stocks = ak.stock_info_a_code_name()
print(stocks.head())
```

### 频率限制

- 建议每次请求间隔 1-2 秒
- 批量请求时使用 `time.sleep()`
- 避免高峰时段（开盘前后）大量请求

### 数据来源识别

从链接域名自动识别新闻来源：

```python
domain_map = {
    "finance.eastmoney.com": "东方财富",
    "news.futunn.com": "富途牛牛",
    "news.10jqka.com.cn": "同花顺",
    "finance.sina.com.cn": "新浪财经",
}
```
