---
name: skill-fin-news
description: 实时财经头条生成器。采集东方财富财经要闻 + Pandadata 市场数据，由 AI 精选 5 条并撰写深度文章（含事实描述、数据解读、大V点评）。
license: GPL-3.0-only
metadata:
  organization: quantskills
  organization_url: https://github.com/quantskills
  repository: skill-fin-news
  repository_url: https://github.com/quantskills/skill-fin-news
  project_type: skill
  collection: quantskills
  category: finance-news
  tags:
  - finance
  - news
  - realtime
  - china-market
  - a-share
  - stock
  - macro
  platforms:
  - claude-code
  - codex
  - openclaw
  - cursor
  status: stable
  validation_level: runnable
  maintainer_type: custom
  maintainer: xixihaha-dzh
  contributors:
  - xixihaha-dzh
  summary_zh: 实时财经资讯聚合，AI 精选 5 条头条并撰写深度分析文章。
  summary_en: Real-time China financial news aggregator. Curates top 5 headlines with AI-written deep analysis (fact description, data interpretation, expert commentary).
quantSkills:
  project_type: skill
  category: finance-news
  tags:
  - finance-news
  - realtime
  - china-market
  - a-share
  platforms:
  - claude-code
  - cursor
  status: stable
  validation_level: runnable
  maintainer_type: custom
  summary_zh: 实时财经资讯聚合，AI 精选 5 条头条并撰写深度分析文章。
  license: GPL-3.0
---

```json qsh-form
{
  "version": 1,
  "task": {
    "placeholder": "补充希望重点覆盖的财经事件、市场或文章风格（可选）"
  },
  "fields": [
    {
      "key": "focus",
      "label": "重点关注",
      "type": "text",
      "placeholder": "例如 A股、宏观政策、人民币汇率"
    }
  ],
  "prompt_template": "{{#task}}任务与材料：\n{{task}}\n\n{{/task}}{{#attachments}}用户上传的材料（已放入工作区）：\n{{attachments}}\n\n{{/attachments}}采集并整理实时财经新闻与市场数据，去重后精选 5 条最具代表性的头条。{{#focus}}重点关注：{{focus}}。{{/focus}}每条按事实描述、数据解读和兼顾机会与风险的评论三部分撰写，核实深度背景并保留来源边界，输出中文报告。"
}
```

# 实时财经头条

采集实时财经新闻和市场数据，AI 精选头条并撰写深度分析。

## 工作流程

### Step 1: 数据采集

```bash
cd scripts && python run.py
```

自动获取：
- A股指数行情（上证/深证/创业板/科创50/沪深300）
- 融资融券余额
- 宏观数据（M2、M1、USD/CNY、外汇占款）
- 东方财富要闻 + 华尔街见闻快讯（API），多源混合去重后 15 条

输出到 `output/实时财经头条_YYYYMMDD_HHMM.md`（时间戳防覆盖）

### Step 2: AI 精选 + 深度撰稿

1. 查看 15 条标题，**去重、筛选出 5 条最具代表性的头条**
2. 对每条使用 `WebSearch` 搜索深度背景信息
3. 撰写每条文章的**三段式分析**：

```
📋 事实描述
（保留原文措辞，不修改创作）

📊 数据解读/分析
（结合文章数据 + 市场关联数据进行解读）

💬 大V点评
（风格化点评，约200字，挖掘机会+提示风险）
```

4. **将撰写完成的文章保存到 `output/实时财经头条_YYYYMMDD_HHMM.md`**

## 调用方式

**CMD+I → skill-fin-news**，或 `@skill-fin-news 生成财经头条`

## 项目结构

```
├── SKILL.md
├── README.md
├── requirements.txt
├── scripts/
│   └── run.py              ← 数据采集脚本
├── references/
│   └── sources.md
└── output/                 ← 生成报告
```

## 数据来源

| 数据 | 来源 | 频率 |
|------|------|:----:|
| A股指数行情 | Pandadata API | 日 |
| 融资融券余额 | Pandadata API | 日 |
| M2/M1/外汇占款 | Pandadata API | 月 |
| USD/CNY 中间价 | Pandadata API | 日 |
| 财经要闻 | 东方财富（爬虫） | 实时 |
| 财经快讯 | 华尔街见闻（API） | 实时 |
| 深度撰稿素材 | WebSearch | 按需 |

## 凭证配置

Pandadata 凭证通过环境变量设置：

```bash
export DEFAULT_USERNAME="your_username"
export DEFAULT_PASSWORD="your_password"
export JAVA_SERVICE_BASE_URL="http://pandadata.pandaaiquant.com"
```

## 参考文件

- `references/sources.md`: 数据来源说明
