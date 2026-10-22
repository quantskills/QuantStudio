# 升级候选：macOS / Windows 完整 Agent 验收提示词

两份提示词都可独立复制。仅用于本 Draft 的隔离验收；正式版安装仍按根 README 的 main 流程。实际结果见 [测试报告](test-report.md)，受阻条件见 [功能矩阵](feature-acceptance.md)。

## macOS

```text
请在这台 macOS 电脑上验收 QuantStudio 的 DSH 0.2.1-rc.2 升级候选。
官方仓库：https://github.com/quantskills/QuantStudio.git
候选分支：codex/upgrade-dsh-0.2.1-rc.2
目标是隔离验收和报告，不合并 main、不发布、不改变日常实例或原数据配置。

1. 记录系统、架构、Git、Node、Corepack、pnpm 的实际路径和版本。
   使用 Node 22.19+ 的 22.x，pnpm 必须 11.7.0；CI 另验证 Linux Node 24.0.0。
   若工具缺失，安装匹配架构的工具到独立位置，保留其他项目的环境。
   记录 Apple Silicon/Intel；/tmp 与 /private/tmp 的验证使用真实路径。只结束本次测试拥有的进程。

2. 在新的可写目录克隆，已有目录先核对 remote/branch/status，不 reset/clean 用户修改：
   git clone -c core.longpaths=true --branch codex/upgrade-dsh-0.2.1-rc.2 https://github.com/quantskills/QuantStudio.git QS-dsh-rc2
   cd QS-dsh-rc2
   git rev-parse HEAD
   阅读 docs/dsh-upgrade/README.md、feature-acceptance.md、migration-rollback.md 和安装脚本。
   记录确定提交，保留真人作者，不附加 Cursor 或其他智能体署名。

3. 逐项运行并检查退出码，失败就定位原因，不删锁文件、不改用 latest：
   corepack pnpm --version
   corepack pnpm install --frozen-lockfile
   corepack pnpm run check
   corepack pnpm run build
   corepack pnpm exec vitest run
   corepack pnpm run verify:packed-deliverables
   node --test benchmark/tests/*.test.mjs
   node benchmark/run-suite.mjs
   node benchmark/verify-history.mjs
   corepack pnpm run ci:plugins
   corepack pnpm run ci:smoke
   node scripts/ci-optional-bundles.mjs
   ci:plugins 使用本机模拟 registry/Git/压缩包/链接并调用真实官方管理器；不安装到日常 Profile。
   可选 bundle 的默认值必须仍为关闭，错误与重复操作不能破坏配置。
   Skill 上下文默认 full，保留用户显式配置；progressive 仍为实验，不自动开启。
   普通验收不得添加 --run 或读取模型凭据。真实基准需另有费用授权，并沿用持久预算，不重置额度。

4. 单独取得固定上游测试支持（不是 latest）。在候选旁边的新目录克隆：
   git clone --filter=blob:none --no-checkout https://github.com/deepseek-ai/deepseek-harness.git ../upstream-dsh-source
   git -C ../upstream-dsh-source checkout 687f282e8625c6b8d11ff58211a90524be2e4317
   回到候选根目录运行：
   corepack pnpm exec vitest run --config vitest.upstream-ui.config.ts
   corepack pnpm exec vitest run --config vitest.upstream-features.config.ts
   如目录不在默认位置，显式设置 QS_UPSTREAM_SOURCE。不要修改固定上游源码或伪造版本。
   四个定制包必须解析到 QS 源码；其余固定上游源码测试不冒充已安装制品的浏览器验收。

5. 执行整目录构造样本及真实浏览器验收：
   corepack pnpm run ci:smoke -- --whole-home --legacy-market
   corepack pnpm exec playwright install --with-deps chromium
   corepack pnpm run ci:smoke -- --whole-home --legacy-market --all-optional --browser-e2e
   脚本隔离 DSH_HOME、Profile、用户目录、缓存、附件和工作目录，使用随机端口和本机模拟模型。
   先安装过渡启动器，再迁移和验证，最后由父子握手验证提交、核心、数据代际、迁移阶段、制品与服务。
   Chromium 必须验证模型配置、流式回复、附件、草稿、重载、窗口调整、自动化入口和官方设置。
   不使用日常 DSH_HOME、默认 ~/.dsh 或原 web Profile；不直接运行 dsh、不改迁移标记凑通过。
   不复制真实密钥、不连接交易账户、不启动自动交易、不补跑历史任务。
   如需人工补查，用 --browser 替代 --browser-e2e，按输出的 stopFile 停止；不要关闭日常服务。

6. 在另一个新目录取得真实旧基线：
   git clone --no-checkout https://github.com/quantskills/QuantStudio.git ../qs-old-baseline
   git -C ../qs-old-baseline checkout 8312624953d62a9aec5cde2c0c2f1175342482fe
   corepack pnpm --dir ../qs-old-baseline install --frozen-lockfile
   回到候选根目录，使用该旧目录的绝对路径运行：
   corepack pnpm run ci:legacy -- <旧源码绝对路径>
   corepack pnpm run ci:legacy -- <旧源码绝对路径> --restore
   这两项只用构造样本，必须验证新启动器运行旧核心，以及先保全候选增量、恢复旧代际后旧核心再次启动。

7. 真实历史兼容只能使用已取得一致性证明的离线备份。
   按 migration-rollback.md 调用 migrateHomeCopy，逐文件摘要、会话 ID/关系/消息/映射与 SQLite 语义核对。
   preserveAndRestoreCopy 必须先保全整个候选，再恢复旧备份到另一个新目录。
   node scripts/verify-legacy-session-copy.mjs <旧源码绝对路径> <recovery输出根目录>
   第二个参数包含 restored-baseline，不要直接传该子目录。该命令只加载旧解析器，不启动 Host。
   真实兼容副本始终 runnable:false；不能直接启动。活动数据库、非空 WAL 或不明一致性都需先停止。
   不打印会话原文、账户、私有路径或凭据；公开报告只有数量、摘要与错误类别。
   未知状态、迁移中断、来源不明、历史接收不明和旧版可读性不明时停止，不绕过保护。
   插件事务恢复工具仅可在指定的测试 DSH_HOME 与 QUANTSKILLS_PROFILE 上运行，先读 --help。

8. 报告确定提交、制品摘要、平台版本、每项通过/失败/受阻/不适用及清理范围。
   依赖/服务加载、单测、模拟服务和真实浏览器是不同证据，不互相替代。
   真实账号登录、SSH、麦克风/语音、翻译、外部模型/搜索/比赛服务仅在另有测试条件时实测。
   缺条件标记受阻，不能导入日常凭据消除阻塞。关键项受阻或失败时保持 Draft。
   不合并主线、不更新正式版本号、不同步 Gitee 主线、不切换日常实例。
```

## Windows

```text
请在这台 Windows 电脑上验收 QuantStudio 的 DSH 0.2.1-rc.2 升级候选。
官方仓库：https://github.com/quantskills/QuantStudio.git
候选分支：codex/upgrade-dsh-0.2.1-rc.2
目标是隔离验收和报告，不合并 main、不发布、不改变日常实例或原数据配置。

1. 记录系统、架构、Git、Node、Corepack、pnpm 的实际路径和版本。
   使用 Node 22.19+ 的 22.x，pnpm 必须 11.7.0；CI 另验证 Linux Node 24.0.0。
   若工具缺失，安装匹配架构的工具到独立位置，保留其他项目的环境。
   使用 PowerShell。Start-Process 必须 -WindowStyle Hidden；文件操作用 -LiteralPath，递归操作前核对绝对目标在本次测试目录内。

2. 在新的可写目录克隆，已有目录先核对 remote/branch/status，不 reset/clean 用户修改：
   git clone -c core.longpaths=true --branch codex/upgrade-dsh-0.2.1-rc.2 https://github.com/quantskills/QuantStudio.git QS-dsh-rc2
   cd QS-dsh-rc2
   git rev-parse HEAD
   阅读 docs/dsh-upgrade/README.md、feature-acceptance.md、migration-rollback.md 和安装脚本。
   记录确定提交，保留真人作者，不附加 Cursor 或其他智能体署名。

3. 逐项运行并检查退出码，失败就定位原因，不删锁文件、不改用 latest：
   corepack pnpm --version
   corepack pnpm install --frozen-lockfile
   corepack pnpm run check
   corepack pnpm run build
   corepack pnpm exec vitest run
   corepack pnpm run verify:packed-deliverables
   node --test benchmark/tests/*.test.mjs
   node benchmark/run-suite.mjs
   node benchmark/verify-history.mjs
   corepack pnpm run ci:plugins
   corepack pnpm run ci:smoke
   node scripts/ci-optional-bundles.mjs
   ci:plugins 使用本机模拟 registry/Git/压缩包/链接并调用真实官方管理器；不安装到日常 Profile。
   可选 bundle 的默认值必须仍为关闭，错误与重复操作不能破坏配置。
   Skill 上下文默认 full，保留用户显式配置；progressive 仍为实验，不自动开启。
   普通验收不得添加 --run 或读取模型凭据。真实基准需另有费用授权，并沿用持久预算，不重置额度。

4. 单独取得固定上游测试支持（不是 latest）。在候选旁边的新目录克隆：
   git clone --filter=blob:none --no-checkout https://github.com/deepseek-ai/deepseek-harness.git ../upstream-dsh-source
   git -C ../upstream-dsh-source checkout 687f282e8625c6b8d11ff58211a90524be2e4317
   回到候选根目录运行：
   corepack pnpm exec vitest run --config vitest.upstream-ui.config.ts
   corepack pnpm exec vitest run --config vitest.upstream-features.config.ts
   如目录不在默认位置，显式设置 QS_UPSTREAM_SOURCE。不要修改固定上游源码或伪造版本。
   四个定制包必须解析到 QS 源码；其余固定上游源码测试不冒充已安装制品的浏览器验收。

5. 执行整目录构造样本及真实浏览器验收：
   corepack pnpm run ci:smoke -- --whole-home --legacy-market
   corepack pnpm exec playwright install --with-deps chromium
   corepack pnpm run ci:smoke -- --whole-home --legacy-market --all-optional --browser-e2e
   脚本隔离 DSH_HOME、Profile、用户目录、缓存、附件和工作目录，使用随机端口和本机模拟模型。
   先安装过渡启动器，再迁移和验证，最后由父子握手验证提交、核心、数据代际、迁移阶段、制品与服务。
   Chromium 必须验证模型配置、流式回复、附件、草稿、重载、窗口调整、自动化入口和官方设置。
   不使用日常 DSH_HOME、默认 ~/.dsh 或原 web Profile；不直接运行 dsh、不改迁移标记凑通过。
   不复制真实密钥、不连接交易账户、不启动自动交易、不补跑历史任务。
   如需人工补查，用 --browser 替代 --browser-e2e，按输出的 stopFile 停止；不要关闭日常服务。

6. 在另一个新目录取得真实旧基线：
   git clone --no-checkout https://github.com/quantskills/QuantStudio.git ../qs-old-baseline
   git -C ../qs-old-baseline checkout 8312624953d62a9aec5cde2c0c2f1175342482fe
   corepack pnpm --dir ../qs-old-baseline install --frozen-lockfile
   回到候选根目录，使用该旧目录的绝对路径运行：
   corepack pnpm run ci:legacy -- <旧源码绝对路径>
   corepack pnpm run ci:legacy -- <旧源码绝对路径> --restore
   这两项只用构造样本，必须验证新启动器运行旧核心，以及先保全候选增量、恢复旧代际后旧核心再次启动。

7. 真实历史兼容只能使用已取得一致性证明的离线备份。
   按 migration-rollback.md 调用 migrateHomeCopy，逐文件摘要、会话 ID/关系/消息/映射与 SQLite 语义核对。
   preserveAndRestoreCopy 必须先保全整个候选，再恢复旧备份到另一个新目录。
   node scripts/verify-legacy-session-copy.mjs <旧源码绝对路径> <recovery输出根目录>
   第二个参数包含 restored-baseline，不要直接传该子目录。该命令只加载旧解析器，不启动 Host。
   真实兼容副本始终 runnable:false；不能直接启动。活动数据库、非空 WAL 或不明一致性都需先停止。
   不打印会话原文、账户、私有路径或凭据；公开报告只有数量、摘要与错误类别。
   未知状态、迁移中断、来源不明、历史接收不明和旧版可读性不明时停止，不绕过保护。
   插件事务恢复工具仅可在指定的测试 DSH_HOME 与 QUANTSKILLS_PROFILE 上运行，先读 --help。

8. 报告确定提交、制品摘要、平台版本、每项通过/失败/受阻/不适用及清理范围。
   依赖/服务加载、单测、模拟服务和真实浏览器是不同证据，不互相替代。
   真实账号登录、SSH、麦克风/语音、翻译、外部模型/搜索/比赛服务仅在另有测试条件时实测。
   缺条件标记受阻，不能导入日常凭据消除阻塞。关键项受阻或失败时保持 Draft。
   不合并主线、不更新正式版本号、不同步 Gitee 主线、不切换日常实例。
```
