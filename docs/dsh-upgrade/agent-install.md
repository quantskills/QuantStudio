# 升级候选：完整 Agent 验收提示词

以下提示词用于本 Draft 的隔离验收，不是正式版本安装。正式版仍使用 README 中的 `main` 安装流程。**不要将“空样本能启动”当作“原数据已经可以迁移”。**

## macOS

```text
请在这台 macOS 上验收 QuantStudio 的 DSH 0.2.1-rc.2 升级候选。
官方仓库：https://github.com/quantskills/QuantStudio.git
分支：codex/upgrade-dsh-0.2.1-rc.2
目标仅是隔离验收并交付报告，不合并 main、不发布标签、不改变已有实例。

1. 记录 macOS 版本、Apple Silicon/Intel、Git、Node 和 pnpm 的版本及路径。
   阅读该分支 docs/dsh-upgrade/README.md、migration-rollback.md、package.json 和安装脚本。
   使用受支持的 Node 22.19+ 22.x；本候选本地已测 22.23.2，其他版本不能自动写成已验证。
   pnpm 必须是 11.7.0。需要安装工具时保留其他项目使用的版本，不修改系统默认环境来强行通过。

2. 在新的、用户可写的独立目录克隆指定分支，不 reset/clean 已有仓库。
   记录完整提交 SHA。检查工作区是否有用户修改；有则先保存，不能覆盖。
   保留 Git 作者信息，不附加 Cursor 或其他智能体署名。

3. 在仓库根目录使用 Corepack 或现有固定版本 pnpm：
   corepack pnpm --version
   corepack pnpm install --frozen-lockfile
   corepack pnpm run check
   corepack pnpm run build
   corepack pnpm exec vitest run
   每一步检查退出码；错误要修复或标记失败，不能删锁文件、跳过测试或升级到 latest。

4. 使用 corepack pnpm run ci:smoke 启动自动构造的无凭据临时样本。
   它会隔离 DSH_HOME、Profile、Documents 和用户级缓存，并通过真实启动器校验 IPC 身份。
   不直接运行 dsh，不手写 validated 迁移记录，不将测试指向日常目录。
   不复制生产密钥，不连接交易账户，不启动自动交易，不补跑历史任务。

5. 需要浏览器验收时，在持久终端运行：
   corepack pnpm run ci:smoke -- --browser
   以日志里的临时地址为准。检查工作台、设置、模式选择、草稿重启保存、附件、审批、专家团、子任务和交易空状态。
   记录实际构建摘要、提交与失败步骤。只有 HTTP 正常不算浏览器通过。
   使用测试脚本给出的 stopFile 结束本次测试；不要结束任何无关或日常进程。
   macOS /tmp 可能映射到 /private/tmp，路径验证使用真实路径。

6. 如需历史兼容验证，仅使用已经一致性备份的离线副本，执行 audit-session-copy / migrateSessionCopy。
   不对副本启动完整 Host。报告只给数量、校验摘要和错误类别，不输出会话原文、路径中的私有信息或凭据。
   任何不确定的迁移阶段、来源、接收方历史和旧版可读性都应停止，不绕过保护。

7. 交付平台、工具版本、提交 SHA、制品摘要、各项通过/失败/受阻/不适用结果及清理范围。
   对账号、语音硬件、SSH、外部比赛服务条件不足的项目标记受阻。
   官方插件管理器迁移、全数据激活、真实旧核心启动与回退尚未验收时，PR 保持 Draft。
   不修改日常数据目录、原 Profile 和用户当前服务。
```

## Windows

```text
请在这台 Windows 上验收 QuantStudio 的 DSH 0.2.1-rc.2 升级候选。
官方仓库：https://github.com/quantskills/QuantStudio.git
分支：codex/upgrade-dsh-0.2.1-rc.2
目标仅是隔离验收并交付报告，不合并 main、不发布标签、不改变已有实例。

1. 用 PowerShell 记录 Windows 架构、Git、Node、Corepack 和 pnpm 的版本及实际路径。
   阅读 docs/dsh-upgrade/README.md、migration-rollback.md、package.json 和启动脚本。
   使用 Node 22.19+ 的 22.x，推荐已在本候选验证的 22.23.2；pnpm 必须是 11.7.0。
   不把其他 Node 版本的 engines 声明当成实测结果。

2. 在短且独立的可写路径克隆：
   git clone -c core.longpaths=true --branch codex/upgrade-dsh-0.2.1-rc.2 https://github.com/quantskills/QuantStudio.git QS-dsh-rc2
   已有目录先检查 remote/branch/status，不强制重置、清理或覆盖它。
   记录完整提交 SHA；保留真人作者，不增加智能体署名。

3. 在根目录逐项运行，检查 $LASTEXITCODE：
   corepack pnpm --version
   corepack pnpm install --frozen-lockfile
   corepack pnpm run check
   corepack pnpm run build
   corepack pnpm exec vitest run
   Corepack 缺失或签名失败时修复工具，不删锁文件、不改用 latest、不绕过安装和测试。

4. 运行 corepack pnpm run ci:smoke。
   脚本会创建无凭据临时 DSH_HOME/web Profile、临时 Documents 及用户级缓存，执行真正的启动器握手。
   不使用日常 DSH_HOME、默认 ~/.dsh 或原 web Profile，不直接运行 dsh，也不伪造迁移状态。
   不复制真实密钥，不连接交易账户，不启动自动交易，不补跑历史任务。

5. 浏览器验收使用持久终端执行：
   corepack pnpm run ci:smoke -- --browser
   以输出的临时端口为准，测试工作台、设置、模式、重启后草稿、附件、审批、专家团、子任务和交易空状态。
   留下脱敏截图、提交 SHA、实际制品摘要和失败步骤；HTTP 可访问不能替代浏览器验收。
   如用 Start-Process，必须 -WindowStyle Hidden，并记录自己启动的进程；仅结束本次测试的进程树。
   使用脚本给出的 stopFile 结束浏览器测试。不要关闭或迁移用户日常服务。

6. 历史数据只能来自一致性备份的离线副本。调用 audit-session-copy / migrateSessionCopy，保留原文件和校验清单。
   不用完整 Host 打开兼容副本。不要打印原文、凭据或账户配置。
   所有删除/移动使用 PowerShell -LiteralPath；递归操作前核对绝对目标在本次测试目录内。
   未知状态、路径越界、来源不明或旧版可读性不明时停止，不绕过检查。

7. 报告平台、工具版本、候选提交及制品摘要，分列通过、失败、受阻、不适用。
   macOS/Linux、账号登录、SSH、语音硬件和外部服务不能凭 Windows 单测宣称通过。
   官方插件管理器迁移、全数据激活、旧核心启动及整目录回退仍缺证据时，保持 Draft。
   不修改主线、正式版本号、Gitee 主线、日常数据或原配置。
```
