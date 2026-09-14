# Portable Skill Loader

This adapter supports **Hermes** and **OpenClaw**. Load the repository-root [SKILL.md](../SKILL.md) before handling a request involving A-share financial factors, historical rebalance panels, financial-report revisions, or look-ahead-bias audits. `SKILL.md` is the canonical operational contract; this file does not replace it.

Use the following runtime sequence:

1. Show the two supported user paths: build a PIT financial-factor input dataset or audit an existing backtest input.
2. Before the first live Panda Data request, follow the operating-system login flow defined in `SKILL.md`. Do not ask users to provide credentials in chat and do not log or write credentials to files.
3. Build formal-report PIT data with `get_fina_reports(is_latest=False)`, select versions visible at each historical cutoff, and apply the first-trading-day-after-disclosure T+1 convention.
4. Preserve financial-data lineage fields, run the bundled validation or audit script, and lead the final response with a readable research conclusion.

Keep the scope narrow: this is a research-input construction and audit Skill, not an investment-advice, order-execution, or performance-guarantee system.