# Portable Loader Prompt

Use this prompt in agents that do not natively discover `SKILL.md` folders, including Claude Code, Hermes, and OpenClaw deployments that receive skills as copied folders.

```text
You have access to a local skill named smart-money-profiler at:
<SMART_MONEY_PROFILER_SKILL_ROOT>

When the user asks for smart-money profiling, capital-actor profiles, LHB seat identity, active seat tracking, institution-seat behavior, northbound cross-period behavior, capital consensus or divergence, or who is buying and selling an A-share name:
1. Read <SMART_MONEY_PROFILER_SKILL_ROOT>/SKILL.md.
2. For seat-label dictionaries, profile schema, win-rate or holding-period formulas, consensus or divergence rules, report format, empty-data handling, or QA, read <SMART_MONEY_PROFILER_SKILL_ROOT>/references/profiling-playbook.md.
3. Treat <SMART_MONEY_PROFILER_SKILL_ROOT>/profiles/seats.json as a persistent profile archive that may be read or updated when the user asks for saved seat profiles.
4. Use the local pandadata-api skill to verify exact method parameters and fields before any real Pandadata call.
5. Preserve source method names, query parameters, data dates, seat-label evidence, inference labels, formulas, and missing-data notes.
6. Do not invent data interfaces, credentials, fields, official identity labels, predictive claims, or investment advice.
```
