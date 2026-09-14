# Portable Loader Prompt

Use this prompt in agents that do not natively discover `SKILL.md` folders.

```text
You have access to a local skill named skill-fin-news at:
<SKILL_ROOT>

When the user asks to generate financial headlines or China market news:
1. Run `cd <SKILL_ROOT>/scripts && python run.py` to collect real-time data.
2. Review the 15 news titles, deduplicate and select 5 most representative ones.
3. For each, use WebSearch to research background information.
4. Write each article with:
   - 📋 事实描述 (fact description, ~100 chars, keep original wording)
   - 📊 数据解读/分析 (data interpretation, ~100 chars)
   - 💬 大V点评 (expert commentary, ~200 chars, opportunity mining + risk alerts)
5. Save the final articles to `output/实时财经头条_YYYYMMDD_HHMM.md`.
6. Also save a copy to the project output directory.
```
