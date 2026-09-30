<div align="center">

# QuantStudio

### QUANT × Work × Trade

**量化研究、日常工作、交易执行，一个开源工作台。**

来自 PandaAI 旗下的 QuantSkills 开源社区

[开始使用](#开始使用) · [Agent 安装](#agent-install) · [QUANT](#quant量化研究) · [Work](#work日常工作) · [Trade](#trade研究盯盘与交易) · [English](README.en.md) · [GitHub](https://github.com/quantskills/QuantStudio) · [Gitee](https://gitee.com/quantskills/QuantStudio)

![QuantStudio 首页：描述任务，选择技能、专家或专家团](docs/images/launch-white/hero.png)

</div>

QuantStudio 把研究市场、处理材料和执行交易放在同一个工作台里。你可以让它核对一份回测、整理 Excel、制作汇报，也可以连接期货模拟赛账户，让 JEV 持续盯盘，或让 AI 交易员按你的要求跟踪多个合约。

对话用来说明需求，技能保存方法，专家和专家团承担分工。报告、图表、代码、文件，以及交易计划和成交回执，都有各自可以打开核对的位置。

| 方向 | 你可以从这里开始 | 在工作台里得到什么 |
| --- | --- | --- |
| **QUANT · 量化研究** | “复盘今天的市场，检验这个因子，核对策略回测。” | 研究报告、数据、图表、因子评估与可复查的代码。 |
| **Work · 日常工作** | “合并这些表格，把材料整理成文档和汇报。” | 工作簿、文档、演示文稿和任务交付文件。 |
| **Trade · 研究与交易** | “研究这个合约，按我的策略盯盘，管理多个交易品种。” | 账户与行情、模型判断、交易计划、委托成交和扣费后的平仓盈亏。 |

工作台支持 Windows、macOS、Linux 本地运行，也可以部署为团队共享工作区。模型与数据服务按你的配置连接；不同任务需要的 Python、文档工具或赛事 CLI 按需准备。

## QUANT：量化研究

从市场复盘、财报解读到因子研究、策略编写与回测审查，把问题交给对应的技能、专家或专家团。已有资料和数据可以直接放进工作区，研究过程保留在会话与执行轨迹中。

例如：**“把这份双均线回测整理成报告，检查交易成本、最大回撤和样本外表现。”** 一边对话核对结论，一边在右侧打开报告、表格和代码，继续追问时仍保留上下文。

![研究对话与结果工作台：核对回测，查看报告、净值曲线和对照表](docs/images/launch-white/report.png)

**技能、专家、专家团各做什么？**

| 能力 | 用法 |
| --- | --- |
| **技能** | 保存一套方法和步骤，例如每日复盘、财务分析、因子检验。可以发现、安装，也可以把自己的流程创建为技能；普通工作区会话同样可以加载。 |
| **专家** | 把职责、技能和交付要求组合成角色，例如财报专家、回测审查师、PPT 汇报专家。 |
| **专家团** | 给复杂任务安排负责人、成员和任务依赖，例如分别研究行业、资金、基本面，再汇总报告。 |

**数据库**管理本地数据缓存，支持查询来源、日期范围和表格预览。**结果工作台**打开 HTML、Markdown、PDF 等报告与文件，便于核对与下载。在线能力目录与仓库附带的可迁移能力快照分别管理，见[快照与导入说明](docs/library-snapshot.md)。

## Work：日常工作

量化研究之外，QuantStudio 也处理日常办公任务：清洗表格、汇总销售数据、整理会议纪要、写文档、做演示文稿。选择一个专家，或让专家团分工处理同一批材料。

例如：**“合并这几份销售表，按月份和部门汇总，再做一份周会汇报。”** 交付的是可以打开检查的文件，具体格式取决于当前模型、技能与文档工具。

![办公专家：表格、文档、会议纪要与演示文稿](docs/images/launch-white/work.png)

会话可以继续、归档、恢复或删除。「会话删除」保留生成文件；「完整删除」先展示可删除的文件清单，再次确认后处理。归档会话统一在设置中管理。[会话与文件管理说明](docs/session-lifecycle.md)

## Trade：研究、盯盘与交易

**Trade 是 QuantStudio 的交易部分。比赛首页提供 JEV 盯盘、AI 交易员、Ai辅助三个独立入口，共用已连接的比赛账户。**

当前期货交易通过 PandaAI 比赛 CLI 接入**期货模拟赛**。行情、持仓、计划、委托和成交回执接在同一条流程中；页面显示的提交状态与实际成交分别记录。

![Trade 首页：JEV 盯盘、AI 交易员与 Ai辅助三个独立工作台](docs/images/trade/trading-workspaces.png)

| 入口 | 适合怎么用 | 如何执行 |
| --- | --- | --- |
| **JEV 盯盘** | 写下策略与入场、退出、等待条件，由 TypeSafe Jev 结合 K 线、报价、持仓和约束持续判断。可选择模板，也可以描述自己的要求。 | 支持多个合约。选择逐笔确认，或在启动时授权自动下单。 |
| **AI 交易员** | 使用 QS 已配置的大模型，或选择神经决策引擎，按交易要求分别跟踪多个合约、判断目标仓位。 | 通过比赛 CLI 预演、生成并执行计划；同样支持逐笔确认或授权后的自动下单。 |
| **Ai辅助** | 通过对话查持仓、研究行情、复盘成交，把想法整理成交易计划。 | 对话生成的交易计划由用户核对确认后执行。 |

### 持仓与判断，打开就能看到

AI 交易员的「交易」页先显示平仓净盈亏、持仓浮盈与当日成交，再展示当前持仓和最近动作。每个合约做了什么、为什么继续等待，可以从这里查看；行情连接、交易计划与账户信息在下方按需展开。

![AI 交易员：当前持仓、合约手数与最近决策](docs/images/trade/positions-and-decisions.png)

**多品种一起管理。** 按名称、代码或交易所搜索并勾选品种，选择实际交割月份，也可手填合约。品种目录覆盖国内六家期货交易所；实际合约是否有行情、是否可交易，以比赛柜台返回为准。多个合约分别决策，共用账户资金与接口额度。

**用几句话说明要求。** 大模型交易员复用 QS 中已配置并验证的模型；JEV 使用单独配置的 TypeSafe API Key。交易要求、决策引擎、合约、手数与执行方式在各自工作台的设置中修改，高级额度按需展开。

### 成交、手续费与净盈亏，直接核对

在「交易」页点击 **查看成交记录**，原位置展开成交明细；按日期、合约筛选，查看每笔操作、手数、成交价、手续费和平仓净盈亏。表格下方的 **返回持仓** 切回持仓视图。

**平仓净盈亏 = 平仓毛利 − 对应开仓手续费 − 本笔平仓手续费。**

分批平仓按对应开仓手数分摊费用；跨日开仓记录保留成本。缺少手续费或开仓证据时显示「待核算」，不会把缺失费用当成零。「手续费合计」包含所选日期内尚未平仓的开仓费用，因此不应再从已经扣费的净盈亏中重复扣减。持仓浮盈是按报价估算的未扣费数值。

![成交明细：按日期和合约筛选，查看手续费与扣费后的平仓净盈亏](docs/images/trade/fills-net-pnl.png)

### 交易表现：收益从哪里来，费用扣了多少

「表现」页按单日、近 7 日、近 30 日或自定义日期查看收益与成交，支持切换采样周期、检查采样缺口和导出 CSV。账户平仓净盈亏、区间净收益、最大回撤与交易员平仓胜率集中展示；下方展开净盈亏曲线、收益拆解、品种贡献和胜负分布。

![交易表现实拍：扣费后的账户净盈亏、收益拆解、品种贡献与平仓胜负分布](docs/images/trade/trading-performance.png)

**先看统计范围，再比较数字。**「表现」页的账户收益统计整个比赛账户；「交易」页的平仓净盈亏按 AI 交易员的配对成交计算，两者范围不同。收益拆解单列开仓与平仓手续费；品种贡献、平仓胜率等毛收益指标也明确标注「未扣手续费」。缺失数据保留为空，不用零代替。

「记录」页保留运行过程，**每页 20 条**，支持按来源筛选、删除所选或删除全部。删除前确认范围，清理列表后仍保留成交回执、盈亏统计与策略审计底账。

本节截图均来自期货模拟赛实际界面，包含不同时间的运行状态；数字仅对应截图时点，用于说明功能，不代表未来收益。

### 第一次运行

1. **配置模型与数据。** 在「设置 → 模型服务」配置所用模型，JEV 另需自己的 TypeSafe Key；历史分钟行情需要连接 PandaData。
2. **连接比赛账户。** 进入「比赛 → 期货模拟赛」，连接账户，再打开 JEV 或 AI 交易员工作台。
3. **选择合约、写下要求。** 勾选一个或多个品种，核对实际合约，设置交易要求与单笔手数。AI 交易员的大模型模式需基础 Python 控制器；神经模式另需专用 Python 与 MaleCNS，按引导准备即可。无需 Blender。
4. **选择执行方式并启动。** 逐笔确认模式先查看计划；自动下单模式在启动时核对账户、合约、额度和风险，授权后通过 CLI 自动提交。
5. **看回执与结果。** 成交以柜台回报为准。数据未就绪、模型超时或接口限流会显示状态与原因；有信号不等于一定下单，提交也不等于成交。

暂停会停止后续新委托，**不会撤销已提交委托，也不会自动平仓**。JEV 与 AI 交易员不同时提交同一账户的策略计划。查询与交易共用比赛接口额度：查询类 60 次/分钟，交易类 10 次/分钟；限流遵守服务端提示，至少等待 30 秒。

当前 JEV 期货 CLI 联动支持 Windows、macOS 本机运行，AI 交易员的首次准备流程以 Windows 为主。详细说明：[期货与 JEV](docs/contest.md) · [JEV 多品种配置](docs/jev-multiple-contracts.md) · [AI 交易员](docs/fly-integration.md)。

**因子比赛**也在「比赛」内：提出研究目标，确认批次与预算，查看回测记录，筛选候选、管理因子池并确认参赛提交。研究算力停止阈值不是平台费用封顶。[因子比赛说明](docs/factor-contest.md)

## 开始使用

准备 **Git** 和 **Node.js 22.19+ 的 22.x 版本，或 Node.js 24+**。项目固定使用 pnpm 11.7.0。

```sh
git clone -c core.longpaths=true https://github.com/quantskills/QuantStudio.git
cd QuantStudio
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm run web
```

国内网络可将克隆地址替换为：

```sh
git clone -c core.longpaths=true https://gitee.com/quantskills/QuantStudio.git
```

<a id="agent-install"></a>

### 让本地 Agent 安装：macOS / Windows 完整提示词

在**目标电脑上能操作终端和文件的 Agent** 中，复制对应平台下方的完整提示词。Agent 会检查环境、安装依赖、运行检查并启动页面；需要系统授权或人工操作时会说明具体步骤。两个提示词都自带仓库地址，可以单独复制使用。

<details>
<summary><strong>macOS：展开并复制完整安装提示词</strong></summary>

```text
请在这台 macOS 电脑上安装、验证并启动 QuantStudio，完成后保留可用的本地服务。
官方仓库：https://github.com/quantskills/QuantStudio.git
国内镜像：https://gitee.com/quantskills/QuantStudio.git

1. 检查系统与工具。
   确认是 Apple Silicon 还是 Intel，记录 macOS、Git、Node.js、npm、Corepack 的版本和实际路径。
   阅读仓库 README.md、package.json 的 engines/packageManager 及相关安装脚本。
   当前要求 Node.js 22.19+ 的 22.x，或 24+；pnpm 固定 11.7.0。
   缺少工具时使用官方安装包或本机已有的包管理器，匹配机器架构，不替换仍被其他项目使用的运行环境。
   需要系统授权时说明原因和具体操作。

2. 准备源码。
   选择当前用户可写目录，例如 ~/QuantStudio，执行 git clone -c core.longpaths=true --branch main https://github.com/quantskills/QuantStudio.git。
   GitHub 不可达时可改用上面的 Gitee 镜像并说明。
   已有目录先检查 remote、分支和 git status；干净且可快进时才更新，否则保留它，另选新目录，不强制重置或清理文件。

3. 固定包管理器。
   在仓库目录执行 corepack enable，再执行 corepack pnpm --version，确认等于 package.json 的固定版本（当前 11.7.0）。
   Corepack 缺失或出现旧版本入口/签名错误时，按 https://github.com/nodejs/corepack 的官方说明安装或更新 Corepack，再重试；不要改用 pnpm@latest，不修改 packageManager 或锁文件来绕过问题。
   不要在仓库外执行无版本约束的 pnpm 安装。

4. 安装依赖。
   在仓库根目录执行 corepack pnpm install --frozen-lockfile，每一步检查退出码。
   若失败，定位网络、Node 版本、权限或依赖错误后修复同一问题；不要删除锁文件，也不要把失败当成安装完成。

5. 验证安装。
   依次执行 corepack pnpm run check、corepack pnpm run test、corepack pnpm run test:update。
   汇报每组结果；失败时先定位并报告，不跳过或改测试以宣称通过。
   安装日志和临时文件放在仓库之外，避免普通未跟踪文件使首次启动进入开发模式。

6. 保留已有数据。
   让应用选择数据目录：新安装默认 ~/.dsh-quantstudio，profile 默认 quantstudio；检测到旧 QuantStudio 时可能沿用 ~/.dsh。
   已有 DSH_HOME 或 QUANTSKILLS_PROFILE 先核对并汇报，不盲目覆盖。
   不删除或覆盖这些目录中的会话、密钥和第三方插件，也不手工改写普通 DSH 的 web profile。

7. 启动并保留服务。
   在仓库目录执行 corepack pnpm run web，使用正常启动器，不直接绕过安装器运行 dsh。
   先检查已有服务和端口占用，不结束无关进程；端口冲突时选择空闲端口并记录。
   通过 Agent 的持久终端或受控后台进程保留服务，记录日志位置和停止方法。

8. 验收页面。
   使用启动日志实际给出的地址，不假定固定端口；检查 HTTP 响应，再用浏览器确认 QuantStudio 首页及设置页正常打开、无启动错误。
   若 Agent 没有浏览器能力，明确仅完成 HTTP 验证，并给我人工验收步骤。
   显示源码开发模式时说明原因，不把它说成托管安装成功。
   涉及 /tmp 路径时注意它可能解析为 /private/tmp，以实际路径定位问题。

9. 交付结果。
   列出源码目录、提交号、实际运行目录、DSH_HOME、profile、Node/pnpm 版本、检查结果、访问地址、日志位置，以及停止和下次启动的命令。
   保留服务供我使用。
   模型密钥由我在“设置 → 模型服务”填写，不在日志或回复中输出凭据；本次安装不自动连接交易账户或启动交易。
   macOS 的基础工作台启动成功不等于所有交易运行环境已经就绪；按各模块的平台支持另行说明。
```

</details>

<details>
<summary><strong>Windows：展开并复制完整安装提示词</strong></summary>

```text
请在这台 Windows 电脑上使用 PowerShell 安装、验证并启动 QuantStudio，完成后保留可用的本地服务。
官方仓库：https://github.com/quantskills/QuantStudio.git
国内镜像：https://gitee.com/quantskills/QuantStudio.git

1. 检查系统与工具。
   记录 Windows 版本、x64/ARM64 架构，以及 Git、Node.js、npm、Corepack 的版本和实际路径；可以使用 Get-Command、where.exe 检查多版本 PATH。
   阅读仓库 README.md、package.json 的 engines/packageManager 及安装脚本。
   当前要求 Node.js 22.19+ 的 22.x，或 24+；pnpm 固定 11.7.0。
   缺少工具时使用官方安装包或本机已有包管理器，安装后刷新当前进程 PATH 并重新核验；不要默认要求整套应用以管理员身份运行。

2. 准备源码。
   选当前用户可写的短路径，例如 C:\QuantStudio；该路径不可写或已占用时另选合适目录，避免 OneDrive 同步目录和多层长路径。
   执行 git clone -c core.longpaths=true --branch main https://github.com/quantskills/QuantStudio.git <选定目录>。
   GitHub 不可达时可使用 Gitee 镜像并说明。
   已有目录先检查 remote、分支和 git status；仅在干净且可快进时更新，否则保留原目录另选新目录，不强制重置或清理文件。

3. 固定包管理器。
   在仓库根目录执行 corepack.cmd enable，再执行 corepack.cmd pnpm --version，确认等于 package.json 的固定版本（当前 11.7.0）。
   使用 .cmd 入口避免 PowerShell 的 .ps1 执行策略冲突。
   Corepack 缺失、过旧或与 Node 安装器自带版本冲突时，按 https://github.com/nodejs/corepack 的 Windows 官方说明处理，再重试；需要管理员授权时说明具体步骤，不关闭系统安全策略。
   不使用 pnpm@latest，不修改 packageManager 或锁文件绕过错误。

4. 安装依赖。
   在仓库根目录执行 corepack.cmd pnpm install --frozen-lockfile。
   每条外部命令后检查 $LASTEXITCODE，失败就停止后续步骤并定位原因。
   遇到路径过长，优先使用更短的目录；遇到网络问题先核对连通性，不删除锁文件或随意替换依赖版本。

5. 验证安装。
   依次执行 corepack.cmd pnpm run check、corepack.cmd pnpm run test、corepack.cmd pnpm run test:update，逐项记录退出码和测试结果。
   失败时定位并报告，不跳过或改测试以宣称通过。
   日志与临时文件放在仓库之外，避免普通未跟踪文件使首次启动进入开发模式。

6. 保留已有数据。
   新安装默认使用 %USERPROFILE%\.dsh-quantstudio 和 quantstudio profile；检测到旧 QuantStudio 时可能沿用 %USERPROFILE%\.dsh。
   先核对已有 DSH_HOME、QUANTSKILLS_PROFILE，不盲目覆盖。
   不删除现有会话、密钥或插件，不手工改写普通 DSH 的 web profile。
   仓库目录和数据目录应分别记录。

7. 启动并保留服务。
   在仓库根目录执行 corepack.cmd pnpm run web，使用正常启动器，不直接运行 dsh 绕过准备流程。
   检查已有服务与端口占用，不结束无关进程；如需换端口，先确认启动器参数并选空闲端口。
   优先使用持久终端；如用 Start-Process 在后台启动，使用 -WindowStyle Hidden 并保留日志，正确处理含空格的路径。
   记录 PID、日志与停止方法。

8. 验收页面。
   以启动日志实际给出的地址为准，不写死 3198；使用 Invoke-WebRequest 检查响应，并在浏览器确认 QuantStudio 首页与设置页正常打开、无启动错误。
   如果 Agent 没有浏览器能力，明确仅完成 HTTP 验证并给我人工验收步骤。
   核对实际运行目录和托管状态；源码开发模式与托管安装需如实区分。
   若生成桌面快捷方式，核对目标而不是假设它已可用。

9. 交付结果。
   汇报源码目录、提交号、实际运行目录、DSH_HOME、profile、Node/pnpm 版本、检查结果、访问地址、日志和 PID，以及停止和下次启动的命令。
   保留服务供我使用。
   模型密钥由我在“设置 → 模型服务”填写，不在日志或回复中输出凭据；本次安装不自动连接交易账户或启动交易。
   AI 交易员的 Python 等运行环境按页面引导另行准备，基础工作台安装不要求 Blender。
```

</details>

**安装遇到 Corepack 问题？** 先在仓库内核对固定的 pnpm 版本。Corepack 的安装、更新与 Windows 安装器冲突处理见[官方说明](https://github.com/nodejs/corepack#how-to-install)；本项目使用 pnpm 11.7.0，不跟随[通用安装页](https://pnpm.io/installation)默认安装其他主版本。PowerShell 可将上方手动命令中的 `corepack` 换成 `corepack.cmd`。

打开终端显示的地址，例如 `http://127.0.0.1:3198/`。在「设置 → 模型服务」配置模型，再新建会话开始任务。处理已有材料不要求先连接行情服务。

新安装的配置与凭据放在 `~/.dsh-quantstudio`，使用独立的 `quantstudio` profile，不改动普通 DSH 的 `web` profile。如果检测到旧版 QuantStudio 的启动器，会继续使用原有 `~/.dsh` 数据目录，保留会话与模型配置；原来的 `web` profile 也会保留。

可用 `DSH_HOME` 指定数据目录，用 `QUANTSKILLS_PROFILE` 指定独立的 profile 名。插件安装直接使用项目固定的 pnpm 11.7.0，先在临时目录完成，再切换；旧 profile 备份位于数据目录的 `profiles/.qs-backups/`，启动失败会恢复切换前的 profile。请通过 `corepack pnpm run web` 启动，以使用这套检查与恢复流程。

工作区在设置中查看和选择。按 `Ctrl+C` 关闭本地服务，再运行启动命令即可继续。Windows 建议使用较短的安装路径，避免依赖目录超过系统路径限制。

本地运行时，会话、配置与文件保存在本机，模型与数据服务按你的配置联网。团队部署可共享工作区和产物，**共享部署不提供成员间的数据隔离**。

## 更新与开发

应用支持 GitHub / Gitee 更新来源。正式版本在独立目录验证，正常重启后切换；更新保留自建能力、会话、模型配置、凭据、缓存和产物。仅同步 `main` 不会触发正式版本自动安装。[发布与镜像说明](docs/publishing.md)

`.DS_Store`、`Thumbs.db`、`desktop.ini` 等系统文件不会阻断托管安装与更新。真正的源码修改仍会保留，并使当前目录按开发模式运行；终端会显示实际运行目录。

```sh
corepack pnpm run check
corepack pnpm run test
corepack pnpm run test:update
corepack pnpm run ci:smoke
```

源码位于 `src/` 与 `packages/`，构建产物位于各包的 `lib/`，能力快照位于 `assets/library-v2/`。[运行时基线](SOURCE_BASELINE.md) · [版本记录](RELEASE_NOTES.md) · [宣传素材](docs/launch/README.md)

QuantStudio 采用 [GPL-3.0-or-later](LICENSE) / [PandaAI 商业授权](COMMERCIAL-LICENSE.md) 双授权。第三方组件遵循各自许可证，见[第三方声明](THIRD_PARTY_NOTICES.md)与 `LICENSES/`。

<div align="center">

**QuantStudio · QUANT × Work × Trade · by PandaAI**

[QuantSkills 官网](https://www.quantskills.ai/) · [PandaAI 官网](https://www.pandaaiquant.com/) · [GitHub](https://github.com/quantskills/QuantStudio) · [Gitee](https://gitee.com/quantskills/QuantStudio)

</div>
