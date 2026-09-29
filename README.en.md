<div align="center">

# QuantStudio

### Your personal, open-source quant workspace for the AI era.

**Quant · Work · Trade**

From QuantSkills, an open-source community under PandaAI

[Get started](#get-started) · [Jev monitoring](#jev-market-monitoring-and-proposal-evaluation) · [简体中文](README.md) · [GitHub](https://github.com/quantskills/QuantStudio) · [Gitee](https://gitee.com/quantskills/QuantStudio)

![White workspace: start with a research question](docs/images/launch-white/hero.png)

</div>

**Research methods, specialists, team collaboration and deliverables in one workspace.**

Describe a task, load a skill, choose a specialist or assemble a team. Follow the conversation and execution trace, then inspect the reports, charts, code and files produced. QuantStudio runs locally on Windows, macOS and Linux, and can also be deployed as a shared team workspace. The QuantSkills branding in the current interface identifies its community and capability ecosystem.

## Quant · Work · Trade

| Area | Tasks | Deliverables |
| --- | --- | --- |
| **Quant** | Market reviews, event tracking, capital flows, factor research, strategy development and backtest audits | Research reports, factor evaluations, charts, code and data |
| **Work** | Document preparation, spreadsheet cleanup, meeting notes, business analysis and presentations | Documents, workbooks, slide decks and action lists |
| **Trade** | Futures simulation account inspection, contract research, trade previews and factor competition research | Confirmation plans, execution receipts, research batches and factor pool records |

### Research with results you can inspect

Ask the assistant to turn existing backtest files into a report, check costs and explain limitations. Open the HTML report beside the conversation to examine its charts and tables while continuing the analysis.

![Conversation and HTML report in the white result workbench](docs/images/launch-white/report.png)

This screenshot shows a review of existing historical backtest files, not a promise of future performance.

### Turn working materials into deliverables

Use specialists for spreadsheets, meeting notes, writing, presentations, business analysis and customer proposals. Teams can divide larger reporting and delivery tasks. Supported output formats depend on the configured model, skills and document tools.

![Office specialists and their expected outputs](docs/images/launch-white/work.png)

### Research, preview and choose how to execute

Connect to the futures simulation competition or the fourth factor competition through **PandaAI CLI and competition APIs**. Each has its own account connection and research conversations.

- **Futures simulation:** inspect funds, positions, orders, fills, rankings and quotes. The assistant proposes plans; the user reviews and confirms opening, closing or cancelling orders. Automatic account inspection is read-only.
- **Factor competition:** agree on a research batch and budget, inspect backtests, compare candidates and manage the factor pool. Pool changes and competition submissions use confirmation plans. The compute threshold stops additional work; it is not a guaranteed spending cap.

![Futures research assistant and public contract quotes; account details excluded](docs/images/launch-white/trade.png)

Accounts, Python and appropriate permissions are required. [Futures guide](docs/contest.md) · [Factor competition guide](docs/factor-contest.md)

### Jev: market monitoring and proposal evaluation

QuantStudio integrates [TypeSafe Jev](https://docs.typesafe.ai/introduction), bringing market sampling, strategy evaluation, account inspection and confirmation plans into the futures simulation workspace. Jev evaluates completed bars, live quote snapshots, positions and strategy constraints to suggest holding, opening a long or short position, or closing an existing position. Inspect the evidence before deciding whether to execute a plan.

See the [Jev monitoring guide](docs/contest.md#jev-持续盯盘与自动计划) for configuration and operation details.

![Jev in the futures simulation workspace: account connection, AI assistant and monitoring entry](docs/images/jev/monitoring-workspace.png)

The screenshot shows an earlier layout. The current competition home opens separate JEV, AI Trader and AI Assist workspaces; account connection is shared.

| Capability | What it does |
| --- | --- |
| **Strategy templates** | Choose range mean reversion, trend pullback or breakout following, or create and save your own strategy. Configure the contract, size, sampling frequency and decision interval. |
| **Continuous monitoring** | Prepare minute bars through PandaData and analyze them alongside live competition quotes, funds, positions and open orders. |
| **Reviewable decisions** | Inspect market regime, strategy fit, blockers, action probabilities and analysis history. Distinguish missing data, program constraints and the model's decision to hold. |
| **Constraints and modes** | Set permitted directions, spread limits, opening cooldown, plan limits and an equity-drop stop. Autonomous mode lets Jev weigh strategy evidence; strict mode applies strategy gates first. Both retain account and data-validity checks. |
| **Plans and receipts** | Monitor multiple checked contracts with separate samples and decisions. Recheck the account and quotes before preparing plans; execute by per-order confirmation or an authorized automatic run, then track receipts. |

Configure your TypeSafe API key in **Settings → Model Services → Jev**, then open **Competitions → Futures simulation → Jev monitoring**, connect the competition account and PandaData, and select a template and review its parameters before starting. Keys are stored in the local credential store. The interface shows request records and reported token usage. Custom Chinese strategy text can be translated with a selected, verified model while preserving the original; translation and Jev calls incur separate usage.

Dedicated competition conversations can also ask Jev to assess a proposal's evidence, support and risk. **JEV supports per-order confirmation or automatic submission after the user authorizes the current run and acknowledges its risks.** Plans prepared in AI Assist conversations still require manual confirmation. The equity-drop stop pauses monitoring without automatically closing positions. Action probabilities and confidence describe the model's judgment, not a trading win rate. The current futures CLI integration supports local Windows and macOS installations.

<details>
<summary>View Jev monitoring logs, account funds and trade plans</summary>

**Sampling and decision history:** follow sampling, Jev analysis, decisions to hold, plan creation and pending confirmation in the activity log.

![Jev activity log showing sampling, analysis, plan creation and pending confirmation](docs/images/jev/monitoring-log.png)

**Account and execution records:** inspect funds, positions and orders alongside cancelled or executed plans. Operation completion and actual fills are recorded separately.

![Account funds and trade plans showing equity, margin, risk ratio and plan status](docs/images/jev/account-and-plans.png)

These screenshots show an actual futures simulation session. Account figures reflect the time each screenshot was taken.

</details>

## Skills, specialists and teams

**Skills** capture reusable methods, steps and tool conventions. Discover and install existing skills, or describe a workflow for AI to draft and save after confirmation.

Load skills from the composer into conversations in your own workspace, including existing ordinary conversations. The conversation, workspace and history stay intact, and loaded skills are restored when you reopen it. Specialists and teams still start in separate conversations.

![Skill discovery and creation](docs/images/launch-white/skills.png)

**Specialists** combine responsibilities, instructions and skills into a focused role with its own conversations. Choose an existing equity, financial statement, factor, strategy or office specialist, or create your own.

![Recommended specialists](docs/images/launch-white/experts.png)

**Teams** define a lead, members, dependencies and expected outputs. Start from a company research or market review team, or describe a goal and confirm an AI-generated team draft before starting collaboration.

![Team responsibilities and deliverables](docs/images/launch-white/teams.png)

The portable library snapshot includes **15 skills, 44 specialist definitions and 14 teams**. It is separate from the online catalog and recommendations. It contains no model keys or conversation history and is imported into an empty library only on explicit request. [Snapshot guide](docs/library-snapshot.md).

## Data and results in your workspace

Search local market, news and fundamental data caches, inspect their sources and dates, preview tables, and refresh or remove them. Research checks existing caches before requesting missing or stale data.

![Local data cache and table preview](docs/images/launch-white/database.png)

The result workbench previews HTML, Markdown, PDF, images, code and data files. Resize or collapse panels, inspect outputs and download them.

| Section | Purpose |
| --- | --- |
| Home | Discover capabilities and resume recent work. |
| Skills | Discover, install, create and manage reusable methods. |
| Specialists | Configure a role and its skills; start or resume conversations. |
| Teams | Coordinate members, responsibilities and workflows. |
| Conversations | Manage ordinary, skill, specialist and team conversations; inspect traces and results. |
| Database | Search, preview and manage local data caches. |
| Favorites | Keep frequently used capabilities within reach. |
| Competitions | Open the futures simulation and factor competition workspaces. |
| AI Trader (under Competitions) | Choose a configured QS language model or neural engine, follow multiple contracts, and select manual or automatic execution. A browser-based digital life garden runs independently. |
| QUBE / EVO | Explore and open the corresponding independent PandaAI services. |
| Settings | Configure workspace, models, permissions, plugins, data connections, appearance and updates. |

Themes adjust the interface, icons and accent colors. Animated backgrounds can be disabled, and interface and conversation text sizes are adjustable independently. General feature screenshots use the white theme; the Jev session screenshots use the mist-blue theme. [QUBE](https://www.pandaaiquant.com/agent_quant/) · [EVO](https://www.pandaaiquant.com/evo/)

## Get started

Install Git and **Node.js 22.x at 22.19 or later, or Node.js 24+**. The project pins pnpm 11.7.0. Windows, macOS and Linux share the same launch command; macOS and Linux do not require PowerShell.

```sh
git clone -c core.longpaths=true https://github.com/quantskills/QuantStudio.git
cd QuantStudio
corepack enable
pnpm install --frozen-lockfile
pnpm run web
```

For the Gitee mirror, use `https://gitee.com/quantskills/QuantStudio.git` as the clone URL. Open the address printed in the terminal, typically `http://127.0.0.1:3198/`, configure a model service in Settings and start a conversation. Configure Python, PandaData MCP and competition CLIs as required by the task.

The configuration directory defaults to `~/.dsh` and can be overridden with `DSH_HOME`. Select your workspace in Settings. Press `Ctrl+C` to stop the local service and run the same command to resume.

Local conversations, configuration and files remain on the host; model and data services connect according to your settings. A shared deployment shares conversations and artifacts and **does not isolate data between members**. Concurrency depends on model quotas, workloads and server resources.

### AI Trader: first-time setup (Windows)

1. Open **Competitions → AI Trader → Settings** and choose an engine. Language-model mode reuses a verified QS model and a basic Python controller. Neural mode additionally prepares dedicated neural Python and MaleCNS data. The browser-based Life garden needs no Blender and runs independently of trading.
2. Connect the competition account and PandaData. Search products across the six supported domestic futures exchanges, check multiple products, then look up actual main contracts or enter other delivery months. Verify each contract, exchange and tick size; product coverage does not guarantee quotes or trading permission for every delivery month.
3. Describe the trading requirements and choose per-order confirmation or automatic orders. Automatic mode requires authorization of the current account, contracts, limits and risks before starting. Saving settings does not resume a paused trader. Pausing stops new orders without cancelling submitted orders or closing positions.
4. Once history and current quotes are ready, inspect each contract's decision, plan and execution receipt. Advanced limits and diagnostics stay in settings. JEV and AI Trader share the account's query and trade request budgets: 60 query requests and 10 trade requests per minute. Server rate limits trigger at least a 30-second wait.

History starts with 500 completed bars and persists locally for incremental refresh. The interface distinguishes PandaData history failures from competition quotes, model failures and execution receipts. Dependencies and neural runtime state are stored under `DSH_HOME/quantskills/fly`; account credentials remain with the host. Only a valid, previously authorized automatic run can resume after restart; manually paused runs remain paused, and stale signals are not replayed. See the [configuration and verification guide (Chinese)](docs/fly-integration.md).

### Session deletion and archiving

The session menu offers rename, archive and delete. Archiving requires confirmation; archived sessions can be restored or deleted under Settings. **Session deletion** removes conversation records while preserving generated files. **Complete deletion** previews eligible generated files and requires a second confirmation before removing them. Created skills, agents and teams are retained. See [session lifecycle details (Chinese)](docs/session-lifecycle.md).

## Updates and your own content

Choose GitHub or Gitee as the update source. Available official releases change the update button color and show version details and release notes. Application updates preserve custom capabilities, conversations, model configuration, credentials, caches and workspace artifacts.

Candidates are validated separately and switched on the next normal startup, with rollback on startup failure. A commit to `main` without an official release tag does not trigger an install. When migrating, clone into a new directory and keep the original workspace and `DSH_HOME`. [Publishing and mirrors](docs/publishing.md).

## Development and licensing

```sh
pnpm run check
pnpm run test
pnpm run test:update
pnpm run ci:smoke
```

Source lives in `src/` and `packages/`, built artifacts in `lib/`, and library snapshots in `assets/library-v2/`. [Runtime baseline](SOURCE_BASELINE.md) · [Release notes](RELEASE_NOTES.md) · [Launch media](docs/launch/README.md).

QuantStudio originates from the **QuantSkills open-source community under PandaAI** and is dual-licensed under [GPL-3.0-or-later](LICENSE) and the [PandaAI commercial license](COMMERCIAL-LICENSE.md). Third-party components retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md) and `LICENSES/`.

<div align="center">

**QuantStudio · by PandaAI**

[QuantSkills](https://www.quantskills.ai/) · [PandaAI](https://www.pandaaiquant.com/)

</div>
