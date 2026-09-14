# 行业新闻分析助手 (agent-industry-news)

## 依赖

```bash
pip install -r requirements.txt
```

运行 industry_analyzer.py 需要 Python 3.8+，无额外第三方依赖（仅使用标准库）。

运行 reporter.py 同样只需 Python 标准库。

## 目录结构

```
quantskills-drafts/agent-industry-news/
├── AGENTS.md                              # 根声明文件（YAML frontmatter + 完整编排）
├── requirements.txt                       # Python 依赖
├── scripts/
│   ├── industry_analyzer.py               # 新闻解析与结构化工具
│   └── reporter.py                        # 多格式报告生成器（HTML/CSV/Markdown）
├── references/
│   └── industry-macro-mapping.md          # 行业-宏观数据映射参考
└── output/                                # 报告输出目录
```

## 使用流程

1. **预处理**：`python scripts/industry_analyzer.py --input news.txt -o /tmp/parsed.json`
2. **深度分析**：AI Agent 对每条新闻进行情绪、实体、产业链分析，补充填写分析字段
3. **报告生成**：`python scripts/reporter.py --analysis /tmp/analysis.json --macro /tmp/macro.json -o output/`