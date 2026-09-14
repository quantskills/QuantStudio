# skill-daily-report

跨市场每日复盘报告技能，面向 A 股、港股、美股、日经、韩国市场以及黄金和原油，汇总公开行情、板块、资金和新闻数据，生成结构化 Markdown 报告。

## 使用

要求 Python 3.9+ 和 `requests`：

```bash
python3 -m pip install requests
python3 scripts/fetch_market_data.py
```

在支持技能的运行时中加载根目录 `SKILL.md`，然后请求“生成今日复盘”或“全球市场复盘”。脚本输出到 `/tmp/daily_report_data.json`；完整报告由运行时结合搜索工具补充板块、资金和新闻数据后生成。

## 数据与限制

行情来自新浪财经公开接口，板块、资金流和新闻优先从同花顺公开页面补充，并使用其他公开来源交叉核对。部分市场存在延迟；网络、接口格式、访问限制或非交易日可能导致数据缺失。报告仅用于信息整理和研究参考，不构成投资、交易或收益承诺。

## 运行时

根目录 `SKILL.md` 可直接用于 Codex 和 Claude Code；`agents/` 提供 Cursor、Hermes 与 OpenClaw 的轻量适配入口。

## 许可证

本项目采用 GNU General Public License v3.0 only，详见 [LICENSE](LICENSE)。
