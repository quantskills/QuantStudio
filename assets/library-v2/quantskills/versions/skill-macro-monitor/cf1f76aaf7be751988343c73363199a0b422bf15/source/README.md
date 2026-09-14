# 🏛️ Macro Monitor Skill

**简体中文** | [English](README.en.md)

> 把"查 CPI""本周有什么经济数据""钢铁行业景气度怎么样"这类请求，路由到正确的 Pandadata `get_macro_*` 接口，输出带数据时效标注的中文宏观分析与定期监控。

<p align="center">
  <img alt="macro methods" src="https://img.shields.io/badge/macro_methods-55-brightgreen">
  <img alt="china macro" src="https://img.shields.io/badge/中国宏观-17_类-blue">
  <img alt="industries" src="https://img.shields.io/badge/行业宏观-22_类-orange">
  <img alt="high freq" src="https://img.shields.io/badge/高频特色-12_类-yellow">
  <img alt="calendar" src="https://img.shields.io/badge/经济日历-3_接口-9cf">
  <img alt="requires" src="https://img.shields.io/badge/requires-pandadata--api-7c3aed">
  <img alt="license" src="https://img.shields.io/badge/license-GPLv3-blue">
</p>

---

## 📖 这是什么

`macro-monitor` 是一个 **Agent Skill**：覆盖 Pandadata 全部 **55 个宏观接口**（中国宏观 17 类 + 国际宏观 + 行业宏观 22 类 + 高频特色 12 类 + 经济日历 3 个），支持五种请求模式 —— 单指标查询、经济日历、行业景气度、宏观周报/月报、定期监控。

宏观数据最大的坑是**指标代码和数据时效**：指标成千上万、代码不可猜，且发布滞后、频繁修订。本技能强制"先 `get_macro_detail` 定位代码，再调数据接口"，并把**数据期 + 发布日期**作为答案的一部分，杜绝把旧数据当当期解读。

> 数据契约一律来自姊妹技能 [`pandadata-api`](https://github.com/quantskills/skill-pandadata-api)。

---

## 🗂️ 数据域总览

```mermaid
mindmap
  root((get_macro_*<br/>55 methods))
    指标元数据
      macro_detail
    中国总量宏观 17类
      国民核算 na
      工业 in
      景气指数 ci
      价格指数 pi
      固投 fa · 财政 fi
      货币银行 mb
      利率汇率 ir
      对外经济 fe
      国内贸易 dt
      就业工资 ew
      区域宏观 pm
    国际宏观
      macro_gb
    行业宏观 22类
      钢铁 st · 有色 nf
      汽车 au · 医药 ph
      地产建筑 rc
      能源 en · 化工 ch
      TMT tm ⋯
    高频特色 12类
      电商 ec · 地产 re
      汽车 ad · 家电 ha
      招聘 rb · 大宗 cm ⋯
    经济日历
      macro_cal
      macro_cal_info
      macro_cal_config
```

---

## ⚡ 五种请求模式

```mermaid
flowchart TD
    A["💬 用户请求"] --> B{"🧭 模式分类"}
    B -->|查 CPI / PMI / 社融| C["单指标查询"]
    B -->|本周经济数据| D["经济日历"]
    B -->|某行业景气度| E["行业景气度"]
    B -->|宏观周报 / 月报| F["宏观报告"]
    B -->|定期提醒 / 监控| G["定期监控"]
    C --> H["🔑 get_macro_detail<br/>先定位指标代码，绝不猜码"]
    D --> H
    E --> H
    F --> H
    G --> H
    H --> I["🧪 小样本试调<br/>行数·日期覆盖·单位·频率"]
    I --> J["📅 频率对齐<br/>月/季/年/高频不当作同期证据"]
    J --> K["📝 中文交付物<br/>每个指标标注 数据期+发布日+原始/计算值"]

    style A fill:#e3f2fd,stroke:#1976d2
    style H fill:#fff3e0,stroke:#f57c00
    style K fill:#e8f5e9,stroke:#388e3c
```

| 模式 | 输出 |
|---|---|
| 🔢 **单指标查询** | 最新值、前值、同比/环比、近期趋势、数据时效检查 |
| 📅 **经济日历** | 发布时间、指标、前值、预期值、重要度、发布后跟踪动作 |
| 🏭 **行业景气度** | 需求/生产/价格/库存/出口/融资信号拆分 + 高频数据交叉验证 |
| 📰 **宏观周报/月报** | 总量→价格→需求→货币信用→就业财政→行业高频→日历，11 段骨架 |
| ⏰ **定期监控** | 先产出 YAML 监控契约（指标清单、触发规则、时区、输出格式），确认后再建自动化任务 |

---

## 🚀 快速开始

### 1️⃣ 安装（与 pandadata-api 一起）

```bash
# Claude Code（全局）
cp -r skill-pandadata-api ~/.claude/skills/pandadata-api
cp -r skill-macro-monitor ~/.claude/skills/macro-monitor
```

### 2️⃣ 直接用自然语言提问

```text
最新的 CPI 和 PPI 是多少？处于近5年什么水平？
本周有哪些重要经济数据发布？
钢铁行业现在景气度怎么样？用高频数据验证一下
给我生成一份本月宏观月报
每周一早上8点半提醒我本周经济日历
```

### 3️⃣ 监控契约示例

要求定期监控时，技能会先产出规格让你确认，再创建真实定时任务：

```yaml
monitor_name: macro-weekly-calendar
timezone: Asia/Shanghai
schedule: every Monday 08:30
watchlist:
  - indicator: CPI
    data_method: get_macro_pi
    trigger: new_release_or_revision
  - indicator: 社会融资规模
    data_method: get_macro_mb
    trigger: new_release_or_revision
output:
  format: markdown
  sections: [upcoming_calendar, released_data_review, surprises, next_watchlist]
```

---

## 📦 目录结构

```
macro-monitor/
├── SKILL.md                          # 技能入口：核心规则、工作流、方法路由表
├── references/
│   └── macro-monitor-guide.md        # 📒 完整路由表、默认窗口、报告骨架、监控契约
└── agents/
    ├── cursor-rule.mdc               # Cursor 规则适配
    ├── openai.yaml                   # OpenAI/Codex 适配
    └── portable-loader.md            # 通用加载器
```

---

## 📐 核心约束

| 约束 | 说明 |
|---|---|
| 🔑 先定码再取数 | 指标代码必须来自 `get_macro_detail` 或接口文档，禁止凭记忆猜码 |
| 🕐 时效即答案 | 每个指标标注最新数据期、发布/更新日期；修订数据标注"修订"而非新数据 |
| 📅 频率对齐 | 月/季/年/高频数据不得当作同期相互印证，异步证据显式标注 |
| 🧮 计算透明 | 接口未返回同比/环比而自行计算时，标注 `计算值` 并给出公式 |
| 🗣️ 措辞克制 | 宏观解读用"显示""可能提示""需要验证"，不下确定性投资结论 |
| 🔕 监控防静默 | 定期监控空跑时输出"本期无新数据"，避免静默被误认为发布成功 |

---

## ⚠️ 免责声明

本报告基于公开数据与规则化分析生成，仅供研究参考，不构成任何投资建议。

## 📜 License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

## 🐼 PandaAI / QUANTSKILLS 社群

<div align="center">
  <img src="https://raw.githubusercontent.com/quantskills/.github/main/profile/assets/pandaai-community-qr.jpg" alt="PandaAI 社群二维码" width="220">
  <br>
  <sub>扫码加入 PandaAI 社群，交流 QUANTSKILLS 技能、Agent 工作流与量化研究实践。</sub>
</div>
