---
name: macro-monitor
description: Pandadata macro and industry monitoring skill for macro data lookup,
  economic calendar tracking, industry prosperity analysis, high-frequency macro signals,
  and recurring macro weekly/monthly reports. Use when the user asks for 宏观数据查询, GDP/CPI/PPI/PMI/社融/M2/利率汇率,
  行业景气度, 钢铁/有色/医药/电新/地产等行业宏观, 高频经济信号, 本周经济数据日历, 宏观周报/月报, or scheduled macro monitoring.
metadata:
  organization: QuantSkills
  organization_url: https://github.com/quantskills
  repository: skill-macro-monitor
  repository_url: https://github.com/quantskills/skill-macro-monitor
  project_type: skill
  collection: macro-monitor
quantSkills:
  project_type: skill
  category: monitor
  tags:
  - macro
  - industry
  - calendar
  - monitoring
  - pandadata
  platforms:
  - claude-code
  - codex
  - openclaw
  - cursor
  status: stable
  validation_level: runnable
  maintainer_type: official
  summary_zh: 把"查 CPI""本周有什么经济数据""钢铁行业景气度怎么样"这类请求，路由到正确的 Pandadata getmacro 接口，输出带数据时效标注的中文宏观分析与定期监控。
  summary_en: Macro monitoring skill for Pandadata macro data, economic calendars,
    industry prosperity, and high-frequency signals.
  license: GPL-3.0
  requires:
  - skill-pandadata-api
---

```json qsh-form
{
  "version": 1,
  "task": {
    "placeholder": "补充要查询的宏观指标、行业、时间范围或定时监控要求"
  },
  "fields": [
    {
      "key": "topic",
      "label": "宏观主题",
      "type": "select",
      "default": "weekly",
      "options": [
        { "value": "weekly", "label": "本周宏观周报" },
        { "value": "calendar", "label": "经济数据日历" },
        { "value": "industry", "label": "行业景气度" },
        { "value": "highfreq", "label": "高频经济信号" },
        { "value": "indicator", "label": "单项指标查询" }
      ]
    },
    {
      "key": "focus",
      "label": "重点关注",
      "type": "text",
      "placeholder": "如：房地产链、钢铁景气、CPI/PPI、社融与 M2"
    },
    {
      "key": "date",
      "label": "截至日期",
      "type": "date",
      "help": "留空时使用最新可用数据"
    }
  ],
  "prompt_template": "{{#task}}任务与材料：\n{{task}}\n\n{{/task}}{{#attachments}}用户上传的材料（已放入工作区）：\n{{attachments}}\n\n{{/attachments}}请运行宏观监控，主题为 {{topic}}。{{#focus}}重点关注：{{focus}}。{{/focus}}{{#date}}数据截至 {{date}}。{{/date}}先确认指标代码、频率、单位与发布时间，再按需分析宏观数据、经济日历、行业景气和高频信号；区分原始值、计算值与推断，标注方法、最新数据期和时效风险，输出中文报告。"
}
```

# Macro Monitor

Use this skill to turn macro, industry, and economic-calendar requests into exact Pandadata `get_macro_*` API calls and a sourced Chinese analytical deliverable.

## Core Rules

- Use the `pandadata-api` skill for every API contract check and real call. Search `references/method-index.md` or run `scripts/search_api_docs.py --method <method>` before using any method.
- Never invent indicator codes, parameters, fields, units, release dates, or frequency. First locate candidate indicators with `get_macro_detail`, then call the matching `get_macro_*` data method.
- Treat data freshness as part of the answer. Every material indicator must show the latest data period, release date or update date when available, source method, and whether the value is raw or calculated.
- Separate facts from inference. State observed data first, then label macro conclusions as interpretation with confidence and contradictions.
- Default to Chinese Markdown. Produce HTML/dashboard artifacts only when the user explicitly asks for a visual report.
- If the user asks for a real recurring reminder or monitor, first produce the monitoring spec, then use the runtime's scheduling or automation capability after the user confirms schedule, channel, and timezone.

## Workflow

1. **Classify the request**: single indicator lookup, economic calendar, industry prosperity check, macro weekly/monthly report, or recurring monitor.
2. **Discover indicators**: call or inspect `get_macro_detail` for names, codes, category, frequency, unit, and update metadata. If several candidates match, choose the most standard one or ask a short clarification.
3. **Build the method plan**: use the interface map in `references/macro-monitor-guide.md`; choose the narrowest set of methods that answers the question.
4. **Validate one small call first**: check row count, date coverage, column names, unit, and whether missing data is due to period lag, indicator mismatch, or credentials/runtime setup.
5. **Align dates before interpretation**: do not compare monthly, quarterly, annual, and high-frequency data as if they are same-period observations. Label any asynchronous evidence.
6. **Generate the deliverable**: include conclusions, evidence table, method/parameter appendix, stale-data warnings, and follow-up monitor rules when relevant.

## Common Method Map

| Need | Primary methods |
|---|---|
| Indicator search and code confirmation | `get_macro_detail` |
| China aggregate macro | `get_macro_na`, `get_macro_in`, `get_macro_ci`, `get_macro_pi`, `get_macro_fa`, `get_macro_fi`, `get_macro_mb`, `get_macro_ir`, `get_macro_fe`, `get_macro_dt`, `get_macro_ew`, `get_macro_li`, `get_macro_pr`, `get_macro_se`, `get_macro_sm`, `get_macro_pm` |
| International macro | `get_macro_gb` |
| Industry prosperity | `get_macro_ag`, `get_macro_en`, `get_macro_ch`, `get_macro_st`, `get_macro_nf`, `get_macro_bm`, `get_macro_au`, `get_macro_me`, `get_macro_ee`, `get_macro_tm`, `get_macro_fb`, `get_macro_te`, `get_macro_pp`, `get_macro_ph`, `get_macro_ut`, `get_macro_tr`, `get_macro_rc`, `get_macro_th`, `get_macro_ce`, `get_macro_wr`, `get_macro_fs`, `get_macro_is` |
| High-frequency specialty data | `get_macro_ec`, `get_macro_md`, `get_macro_eh`, `get_macro_ad`, `get_macro_ha`, `get_macro_of`, `get_macro_rb`, `get_macro_re`, `get_macro_ed`, `get_macro_ep`, `get_macro_ar`, `get_macro_cm` |
| Economic calendar | `get_macro_cal_config`, `get_macro_cal`, `get_macro_cal_info` |

Read `references/macro-monitor-guide.md` for the full Chinese routing table, default windows, report templates, and monitoring contract.

## Analysis Modes

- **Single indicator**: return latest value, prior value, year-on-year or month-on-month change when documented or calculated, recent trend, and stale-data check.
- **Economic calendar**: list upcoming releases by date/time, indicator, previous value, consensus/forecast when present, importance, and post-release follow-up task.
- **Industry prosperity**: combine industry macro methods with high-frequency specialty data where possible; distinguish demand, production, price, inventory, export, and financing signals.
- **Macro report**: organize evidence as aggregate demand, production, prices, money/credit, external trade, employment/income, industry/high-frequency confirmation, and policy/event calendar.
- **Recurring monitor**: define trigger schedule, watchlist indicators, alert thresholds, expected data lag, output format, and escalation rules.

## Output Standards

- Use compact tables for data evidence: indicator, method, code, frequency, latest period, latest value, prior value, change, unit, release/update date, and note.
- Explain calculations. If the API does not return同比/环比 and you calculate them, mark the result as `计算值` and show the formula briefly.
- Show missing or empty results explicitly with method, parameters, queried window, and next diagnostic step.
- Avoid deterministic investment calls. Use language such as `显示`, `可能提示`, `需要验证`, and `与...相互印证` for macro interpretation.
- End formal research reports with: `本报告基于公开数据与规则化分析生成，仅供研究参考，不构成任何投资建议。`

## Cross-Agent Use

- Codex and Claude Code can load this folder directly as a skill named `$macro-monitor`.
- Cursor should use `agents/cursor-rule.mdc` as the project rule adapter and keep the full skill folder under `.cursor/skills/macro-monitor`.
- Agents without native skill discovery can paste the prompt in `agents/portable-loader.md`.
