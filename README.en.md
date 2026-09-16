<div align="center">

# QuantStudio

### From a research question to a real deliverable.

QuantSkills AI workspace · by PandaAI

[简体中文](README.md) · [Get started](#get-started) · [GitHub](https://github.com/quantskills/QuantStudio) · [Gitee](https://gitee.com/quantskills/QuantStudio)

![QuantSkills workspace](docs/images/launch/hero-white.webp)

</div>

Describe a task, choose the right capabilities, follow the work, and open the reports, charts, code and files it produces. QuantStudio brings skills, specialists, teams, conversations and data into one workspace for quantitative research, investment analysis and everyday office work.

## One task, from start to finish

1. Describe your goal, input materials and expected output.
2. Load a skill, choose a specialist or assemble a team.
3. Follow the conversation, execution trace and tool calls.
4. Preview, inspect and download the actual deliverables.

![A real research task with its report open in the result panel](docs/images/launch/report-workbench.webp)

The recorded example reads existing moving-average backtest files, recomputes metrics and creates an HTML report and Markdown summary. Historical results illustrate the workflow; they do not predict future returns. Waiting periods are edited out of the promotional video.

## Explore the workspace

| Section | What it does |
| --- | --- |
| Home | Discover capabilities and resume recent work. |
| Skills | Discover, install, create and reuse research methods. |
| Specialists | Start an independent conversation with a role and its configured skills. |
| Teams | Define a lead, members, responsibilities, workflow and deliverables. |
| Conversations | Follow the task and inspect reports, charts, code and files in the result panel. |
| Database | Search, preview, refresh and manage local data caches. |
| Favorites | Keep frequently used capabilities and entry points close at hand. |
| Competitions | Use dedicated futures simulation and factor research workspaces. |
| QUBE / EVO | Explore and open the corresponding independent PandaAI services. |
| Settings | Configure models, permissions, workspace, connections, appearance and updates. |

![Recommended specialists](docs/images/launch/experts.webp)

Specialists cover equity, industry, financial statement, strategy and factor research, as well as spreadsheets, meeting notes, documents and presentations. Teams coordinate larger tasks with explicit responsibilities and outputs.

![Team roles and workflow](docs/images/launch/team-flow.webp)

The portable library snapshot contains **15 skills, 44 specialist definitions and 14 teams**. This snapshot differs from the online discovery catalog. It contains no API keys or conversation history and is imported into an empty library only on explicit request. [Library snapshot](docs/library-snapshot.md).

## Keep results and data within reach

Preview Markdown, HTML, PDF, images, code and data files. Expand images, resize or collapse panels, and download deliverables. The database shows sources, dates, cache status, row counts and table previews; existing data can be checked before requesting more.

![Local database](docs/images/launch/database.webp)

## Competition research

**Futures simulation:** connect a competition account to inspect positions, funds, orders, fills, rankings and quotes. Use the AI assistant for research and review, then explicitly confirm write operations through plan cards. [Futures guide](docs/contest.md).

**Fourth Factor Competition:** define a research goal, approve a batch budget, inspect backtests and manage factor pools. Pool changes and submissions require confirmation. Accounts, registration and service permissions are separate requirements. The compute threshold stops additional runs; it is not a platform-enforced spending cap. [Factor guide](docs/factor-contest.md).

## Make the workspace yours

Choose mist blue, white, jade, ink or other themes. Change interface and conversation text sizes independently, or disable animated backgrounds.

![Live mist-blue interface animation](docs/images/launch/mist-blue.gif)

QUBE provides a separate natural-language strategy and backtesting service; EVO provides a separate factor and strategy research environment. The workspace includes introductions and links to each product.

## Get started

Install Git and **Node.js 22.19+ on the 22.x line, or Node.js 24+**. The project pins pnpm 11.7.0. Windows, macOS and Linux use the same launch command; macOS and Linux do not require PowerShell.

```sh
git clone -c core.longpaths=true https://github.com/quantskills/QuantStudio.git
cd QuantStudio
corepack enable
pnpm install --frozen-lockfile
pnpm run web
```

For the domestic mirror, clone `https://gitee.com/quantskills/QuantStudio.git` instead. Open the local URL printed in the terminal, for example `http://127.0.0.1:3198/`, and configure your model service.

Python, PandaData MCP and competition CLIs are configured as needed for particular tasks. Ordinary conversations and work with supplied files do not require a data-service login.

Configuration defaults to `~/.dsh`; set `DSH_HOME` to change it. The default workspace uses the system Documents directory on Windows and `~/Documents/QuantSkills` on macOS. Allow terminal access if macOS requests Documents permission. Stop with `Ctrl+C` and run the launch command again to resume.

Local sessions, settings and files remain on the local machine; model and data services connect according to your configuration. A shared server workspace shares conversations and outputs; it does not provide per-member data isolation. Concurrency depends on server resources, model services and workload.

## Update without replacing your work

Choose GitHub or Gitee as the release source. Available updates change the button color and show a version and release notes. Download and installation require a click to confirm.

Updates replace application code, runtime packages, assets and bundled templates. Personal skills, specialists, teams, sessions, credentials, caches and workspace outputs are retained. Candidate releases are checked in a separate directory and activated at the next normal launch, with rollback on startup failure. A commit to `main` alone does not create an installable release.

When migrating from an older repository, clone a new directory and retain the existing workspace and `DSH_HOME`. Do not force-reset the old development checkout. [Publishing guide](docs/publishing.md).

## Development and licensing

```sh
pnpm run check
pnpm run test
pnpm run test:update
pnpm run ci:smoke
```

Source: `src/` and `packages/`. Built output: `lib/`. Library snapshot: `assets/library-v2/`. The application integrates a pinned DSH runtime and related components. [Runtime baseline](SOURCE_BASELINE.md) · [Release notes](RELEASE_NOTES.md) · [Media notes](docs/launch/README.md).

QuantStudio is dual-licensed under [GPL-3.0-or-later](LICENSE) / [PandaAI commercial terms](COMMERCIAL-LICENSE.md). Third-party components retain their own licenses and attribution; see [Third-party notices](THIRD_PARTY_NOTICES.md) and `LICENSES/`.

[QuantSkills](https://www.quantskills.ai/) · [PandaAI](https://www.pandaaiquant.com/)
