# A-Share PIT Financial Data Auditor

[中文](README.md)

Build and audit A-share financial-factor inputs for historical rebalances. This Skill answers one focused question: **did a historical rebalance use only financial reports that had been disclosed and were conservatively tradable at that time?**

It is not a generic factor-backtest engine, stock screener, or investment-advice tool. It produces point-in-time (PIT) financial panels, basic financial factors, and an auditable evidence trail for a separate backtest engine.

## What Makes It Different

Most backtest tools assume that a factor table is already prepared. They cannot establish whether the historical table used reports that had not yet been disclosed or values revised later. This Skill turns the financial-report version timeline into verifiable data lineage:

1. **Reconstruct historical visibility instead of using today's latest value.** For every `(security, report period, rebalance date)`, retain the last version disclosed by that date and prevent later restatements from leaking into history.
2. **Apply an explicit, conservative T+1 availability rule.** Do not assume that a disclosure is tradable intraday. Treat it as usable only from the first trading day after disclosure, making the convention reproducible and auditable.
3. **Deliver factor values together with their evidence trail.** Each row carries `quarter`, `disclosure_date`, `available_date`, `as_of_date`, and `vintage_type`, so researchers can trace why a factor was available on a given date.
4. **Build and audit in the same workflow.** In addition to generating PIT panels and single-quarter or TTM factors, audit supplied panels, rebalance dates, and Python code for `is_latest=True`, negative `shift`, missing snapshots, and related risks.
5. **Fail closed on unresolved version ambiguity.** If different versions share the same security, report period, and disclosure date, do not choose arbitrarily. Stop and require a version identifier.

It complements generic factor-backtest tools: this Skill establishes that the input data is time-valid, while the backtest engine evaluates IC, portfolio groups, NAV, turnover, and trading costs.

## Project Status And Maintenance

- Status: QuantSkills Community Project. It is not an official, certified, validated, endorsed, or production-ready QuantSkills project.
- Maintainer: repository contributors. After publication, report reproducible defects, data-contract changes, and methodology issues through the repository issue tracker.
- Intended repository identity: `quantskills/skill-a-share-pit-fundamental-vintage-builder`. See [skill.yml](skill.yml) for machine-readable metadata.

## Runtime Entrypoints

- Codex and Claude Code: read the root [SKILL.md](SKILL.md).
- Cursor: read [agents/cursor-rule.mdc](agents/cursor-rule.mdc).
- Hermes and OpenClaw: read [agents/portable-loader.md](agents/portable-loader.md).
- OpenClaw-compatible interface metadata: see [agents/openai.yaml](agents/openai.yaml).

Every entrypoint treats `SKILL.md` as the single source of workflow truth, including the secure first-live-request login flow and PIT lineage requirements.
## Supported Scenarios

1. Build monthly or custom-rebalance PIT financial panels for specified A-share securities.
2. Convert PIT panels into single-quarter, TTM, and basic quality, profitability, growth, and leverage factors.
3. Audit a supplied financial panel, rebalance schedule, and Python factor or backtest code for common financial-report look-ahead patterns.
4. Generate a concise research summary recording the latest report actually available at each historical cutoff.

## Data Source, Assumptions, And Parameters

- Data source: the user's authorized `panda_data` Python SDK account. This repository contains no Panda Data dataset, credentials, API key, or private research data. Users must comply with the applicable Panda Data terms and data-entitlement rules.
- PIT convention: retrieve retained report versions through `get_fina_reports(is_latest=False)`; treat a report as usable on the first trading day strictly after disclosure, using a conservative T+1 rule.
- Key parameters: symbols, financial-quarter window, rebalance dates or frequency, requested financial fields, and the T+1 availability rule.
- See [references/data-contract.md](references/data-contract.md) for the API and data-lineage contract, [references/factor-definitions.md](references/factor-definitions.md) for factor definitions, and [references/research-boundaries.md](references/research-boundaries.md) for research boundaries.

## Usage

Read [SKILL.md](SKILL.md) for the complete agent workflow and commands. At the first live-data request, the Skill asks the user to choose between building a PIT dataset and auditing an existing backtest. Credentials are entered only in a masked, platform-native login terminal. They are never requested in chat, written to outputs, or stored in this repository.

## Repository Layout

```text
SKILL.md                              Agent workflow and delivery requirements
README.md                             Chinese project documentation
README.en.md                          English project documentation
LICENSE                               GNU GPLv3 license text
skill.yml                             QuantSkills project metadata
agents/                               Cursor, Hermes, and OpenClaw runtime entrypoints
scripts/build_pit_panel.py            Panda Data PIT panel builder
scripts/audit_backtest_input.py       Panel, schedule, and Python code auditor
scripts/derive_fundamental_factors.py Single-quarter, TTM, and basic factor derivation
scripts/generate_rebalance_schedule.py Monthly last-trading-day schedule generator
scripts/generate_research_summary.py  Human-readable research summary generator
references/data-contract.md           API and data-lineage contract
references/factor-definitions.md      Factor formulas and field requirements
references/research-boundaries.md     Data, assumptions, limitations, and risk boundary
tests/                                Deterministic regression tests
evals/evals.json                      Representative user requests
```

## Limitations And Risk Boundary

This Skill mitigates only one kind of look-ahead bias: timing leakage caused by financial-report availability and restatements. It does not address survivorship bias, corporate actions, delisting returns, execution-price assumptions, transaction costs, liquidity, taxes, vendor errors, or model overfitting. Static code checks provide evidence, not proof that an entire strategy is leakage-free.

For research and educational purposes only. It does not provide investment advice, trading instructions, suitability assessments, or performance guarantees.
