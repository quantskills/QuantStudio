# 🧩 JoinQuant → PandaAI Strategy Converter

**简体中文** | [English](README.en.md)

> 将聚宽(JoinQuant)平台的量化策略代码转换为PandaAI(盘达)平台的策略代码。**理解策略思想，而非逐行翻译**，输出可直接运行回测的PandaAI JSON策略配置文件。

![type](https://img.shields.io/badge/type-agent--skill-blue)
![license](https://img.shields.io/badge/license-GPLv3-blue)

---

## 📖 这是什么

本 Skill 用于将 JoinQuant（聚宽）平台上的 Python 量化策略迁移到 PandaAI（盘达）平台。

**核心原则**：这不是一个简单的代码逐行翻译器。JoinQuant 和 PandaAI 的策略架构有本质不同（函数驱动 vs JSON 配置驱动）。本 Skill 在理解原始策略的交易逻辑、信号构造、执行规则和选股范围的**基础**上，重新用 PandaAI 的格式生成策略。

**输入**：聚宽策略 Python 文件

**输出**：PandaAI JSON 策略配置 + 转换报告

## 🚀 快速开始

```bash
cp -r skill-jq-to-panda-converter ~/.claude/skills/jq-to-panda-converter
```

```text
将这个聚宽均线策略转换成PandaAI可运行的策略配置
```

```text
把这个多因子选股策略从聚宽迁移到PandaAI，输出JSON和转换报告
```

## 📦 目录结构

```text
skill-jq-to-panda-converter/
├── SKILL.md                              # 主入口
├── README.md
├── README.en.md
├── LICENSE
├── .gitignore
├── references/
│   ├── jq_patterns.md                    # 聚宽 API 模式大全（含 PandaAI 等价映射表）
│   ├── panda_format.md                   # PandaAI JSON 策略配置格式详解
│   ├── step_by_step_guide.md             # 逐步骤转换指南（含完整示例）
│   └── source_boundary.md                # 数据源边界约束
├── examples/
│   ├── ma_crossover_jq.py                # 聚宽 MA5/MA20 均线交叉策略（原始代码）
│   ├── ma_crossover_panda.json           # 转换后的 PandaAI 配置
│   └── conversion_report.md              # 转换报告
└── agents/
    └── openai.yaml
```

## 🔗 API 映射速查

| 聚宽 API | PandaAI 等价 | 映射方式 |
|---------|-------------|---------|
| `attribute_history(s, c, u, f)` | `get_price(pro_code, u, count=c)[f]` | strategy_content 代码 |
| `order(s, amt)` | `trade_template[].amount` | JSON 配置字段 |
| `order_value(s, val)` | `amount: 0.xx` (百分比) | JSON 配置字段 |
| `order_target(s, 0)` | `type: "close"` | JSON 配置字段 |
| `run_daily(f, 'every_bar')` | `freq_type: 'every_bar'` | JSON 配置字段 |
| `g.variable` | Python 变量 / `keep` | strategy_content 代码 |
| `context.portfolio.available_cash` | `amount: 0.95` 公式 | JSON 配置字段 |
| `log.info(...)` | `print(...)` | strategy_content 代码 |
| `get_index_stocks(idx)` | `stockpool_type: "index"` | JSON 配置字段 |

完整映射表见 `references/jq_patterns.md`。

## 📐 核心约束

| 约束 | 说明 |
| --- | --- |
| 🌐 聚宽专有API限制 | `get_fundamentals(query(...))`、`get_extra_info()`等API无直接等价，需转换策略逻辑 |
| 🚫 不翻译框架函数 | `run_daily/run_weekly/run_monthly`不译为Python代码，映射为JSON配置字段 |
| ⚠️ 信号语义优先 | 确保交易信号条件等效，而非API语法精确匹配 |
| 📋 回测参数一致 | 显式指定start_date、end_date、init_cash等参数 |
| 🔄 状态变量迁移 | 聚宽`g.`对象和`context.portfolio`映射到`keep`字段或Python变量 |

## ⚠️ 免责声明

本仓库仅作研究方法层面的整理，不保证两个平台的回测结果完全一致（填充算法、滑点模型、数据源差异会导致差异）。

## 📜 License

GPL-3.0.
