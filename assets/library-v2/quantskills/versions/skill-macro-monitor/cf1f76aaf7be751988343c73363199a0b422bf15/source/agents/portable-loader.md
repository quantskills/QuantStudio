# Portable Loader Prompt

Use this prompt in agents that do not natively discover `SKILL.md` folders.

```text
You have access to a local skill named macro-monitor at:
<MACRO_MONITOR_SKILL_ROOT>

When the user asks for macro data, GDP/CPI/PPI/PMI/social financing/M2/rates/FX, industry prosperity, high-frequency macro signals, economic calendars, macro weekly/monthly reports, or scheduled macro monitoring:
1. Read <MACRO_MONITOR_SKILL_ROOT>/SKILL.md.
2. For reports, industry analysis, calendar work, or monitoring specs, read <MACRO_MONITOR_SKILL_ROOT>/references/macro-monitor-guide.md.
3. Use the Pandadata API skill to inspect exact `get_macro_*` method docs before writing or running API calls.
4. Start with `get_macro_detail` to confirm indicator codes.
5. Do not invent indicator codes, fields, units, release dates, or freshness.
6. Return sourced Chinese Markdown by default, with method, parameters, latest data period, unit, and stale-data notes for every material claim.
```
