# QuantStudio 安装指南

稳定版安装命令见[开始使用](../README.md#开始使用)。下方提示词适用于能操作本机终端和文件的 Agent。

## 故障排查与本地数据

**安装遇到 Corepack 问题？** 先在仓库内核对固定的 pnpm 版本。Corepack 的安装、更新与 Windows 安装器冲突处理见[官方说明](https://github.com/nodejs/corepack#how-to-install)；本项目使用 pnpm 11.7.0，不跟随[通用安装页](https://pnpm.io/installation)默认安装其他主版本。PowerShell 可将README 安装命令中的 `corepack` 换成 `corepack.cmd`。

打开终端显示的地址，例如 `http://127.0.0.1:3198/`。在「设置 → 模型服务」配置模型，再新建会话开始任务。处理已有材料不要求先连接行情服务。

新安装的配置与凭据放在 `~/.dsh-quantstudio`，使用独立的 `quantstudio` profile，不改动普通 DSH 的 `web` profile。如果检测到旧版 QuantStudio 的启动器，会继续使用原有 `~/.dsh` 数据目录，保留会话与模型配置；原来的 `web` profile 也会保留。

可用 `DSH_HOME` 指定数据目录，用 `QUANTSKILLS_PROFILE` 指定独立的 profile 名。插件安装直接使用项目固定的 pnpm 11.7.0，先在临时目录完成，再切换；旧 profile 备份位于数据目录的 `profiles/.qs-backups/`，启动失败会恢复切换前的 profile。请通过 `corepack pnpm run web` 启动，以使用这套检查与恢复流程。

工作区在设置中查看和选择。按 `Ctrl+C` 关闭本地服务，再运行启动命令即可继续。Windows 建议使用较短的安装路径，避免依赖目录超过系统路径限制。

本地运行时，会话、配置与文件保存在本机，模型与数据服务按你的配置联网。团队部署可共享工作区和产物，**共享部署不提供成员间的数据隔离**。

## 用 Agent 安装

### macOS

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

2. 检出稳定版 v0.1.36。
   选一个当前用户可写的短路径，执行 git clone -c core.longpaths=true --branch v0.1.36 https://gitee.com/quantskills/QuantStudio.git
   Gitee 不可达时可用上面的 GitHub 仓库，仍指定同一标签，并说明选择。
   已有目录仅在工作区干净、远端匹配且已检出 v0.1.36 时复用。否则另选目录并保留现有检出。

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

### Windows

```text
请在这台 Windows 电脑上使用 PowerShell 安装、验证并启动 QuantStudio，完成后保留可用的本地服务。
官方仓库：https://github.com/quantskills/QuantStudio.git
国内镜像：https://gitee.com/quantskills/QuantStudio.git

1. 检查系统与工具。
   记录 Windows 版本、x64/ARM64 架构，以及 Git、Node.js、npm、Corepack 的版本和实际路径；可以使用 Get-Command、where.exe 检查多版本 PATH。
   阅读仓库 README.md、package.json 的 engines/packageManager 及安装脚本。
   当前要求 Node.js 22.19+ 的 22.x，或 24+；pnpm 固定 11.7.0。
   缺少工具时使用官方安装包或本机已有包管理器，安装后刷新当前进程 PATH 并重新核验；不要默认要求整套应用以管理员身份运行。

2. 检出稳定版 v0.1.36。
   选一个当前用户可写的短路径，执行 git clone -c core.longpaths=true --branch v0.1.36 https://gitee.com/quantskills/QuantStudio.git。
   Gitee 不可达时可用上面的 GitHub 仓库，仍指定同一标签，并说明选择。
   已有目录仅在工作区干净、远端匹配且已检出 v0.1.36 时复用。否则另选目录并保留现有检出。Windows 路径应避开 OneDrive 同步目录。

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
