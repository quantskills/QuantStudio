# 实时财经头条

实时财经资讯聚合 + AI 深度撰稿工具。

采集东方财富要闻、华尔街见闻快讯和 Pandadata 市场数据，由 AI 精选 5 条头条并撰写深度分析文章（含事实描述、数据解读、大V点评）。

## 工作流程

```
Step 1: python run.py          ← 自动采集数据
   ├── Pandadata API → A股指数/两融/M2/USDCNY
   ├── 东方财富 → 要闻
   └── 华尔街见闻 → 快讯（API）

Step 2: AI 精选 + 深度撰稿    ← 由 Claude 完成
   ├── 去重、筛选 5 条头条
   ├── WebSearch 搜索深度背景
   └── 撰写 📋事实描述 + 📊数据解读 + 💬大V点评

Step 3: 保存                    ← 输出到 output/
   └── 实时财经头条_YYYYMMDD_HHMM.md（时间戳防覆盖）
```

## 目录结构

```
├── SKILL.md                ← Claude Code 技能定义
├── README.md
├── requirements.txt        ← Python 依赖
├── scripts/
│   └── run.py              ← 数据采集脚本
├── agents/                 ← 平台配置
├── references/
│   └── sources.md          ← 数据源说明
└── output/                 ← 生成报告
```

## 安装

```bash
pip install -r requirements.txt
```

依赖项：`panda_data`、`requests`、`beautifulsoup4`、`pandas`

## 使用方法

### 数据采集

```bash
cd scripts
python run.py
```

输出到 `output/实时财经头条_YYYYMMDD_HHMM.md`，包含市场概览 + 15 条新闻（多源混合，关注池标记★）。

### AI 深度撰稿

在 Claude Code 中通过 `skill-fin-news` 技能调用：

```
CMD+I → skill-fin-news
或
@skill-fin-news 生成财经头条
```

流程：查看 15 条标题 → 去重精选 5 条 → WebSearch 搜索背景 → 撰写三段式分析 → 保存到文件。

## 数据来源

| 数据 | 来源 | 频率 |
|------|------|:----:|
| A股指数行情 | Pandadata API | 日 |
| 融资融券余额 | Pandadata API | 日 |
| M2/M1/外汇占款 | Pandadata API | 月 |
| USD/CNY 中间价 | Pandadata API | 日 |
| 财经要闻 | 东方财富 | 实时 |
| 财经快讯 | 华尔街见闻（API） | 实时 |
| 深度撰稿素材 | WebSearch | 按需 |

## 凭证配置

Pandadata 凭证通过环境变量设置（不设则运行报错）：

```bash
export DEFAULT_USERNAME="your_username"
export DEFAULT_PASSWORD="your_password"
export JAVA_SERVICE_BASE_URL="http://pandadata.pandaaiquant.com"
```

## 配置说明

编辑 `scripts/run.py` 中的配置区：

- `NEWS_COUNT`：新闻输出数量（默认 15）
- `SKIP_KEYWORDS`：过滤的非新闻关键词
- `WATCH_KEYWORDS`：关注池关键词（命中自动标记 ★）
- `MAX_RETRIES`：API 重试次数（默认 2）
- `NEWS_SOURCES`：新闻源列表（东方财富、华尔街见闻 API）

## 项目边界

- **数据来源**: Pandadata API（量化行情）、东方财富（新闻标题）、华尔街见闻（快讯 API）
- **使用限制**: 本工具仅用于信息聚合和内容创作辅助，不构成投资建议
- **已知限制**: 
  - 新闻摘要来自网页 meta description，非全文，可能存在信息偏差
  - 深度分析由 AI 生成，不代表任何机构或个人观点
  - 行情数据为收盘后数据，非实时盘中
  - 东方财富爬虫依赖页面结构，可能因改版失效
- **风险声明**: 本项目的分析内容仅供参考，不构成任何投资建议或荐股。投资有风险，入市需谨慎。
- **研究/教育用途**: 本项目定位为研究学习和内容创作辅助工具

---

*仅供参考，不构成投资建议*
