# 数据迁移与回退操作

## 当前边界

本候选提供**完整离线代际迁移、会话格式转换、保全恢复和构造样本激活**。真实备份副本只做离线兼容核对，不提供不经复核的一键生产切换。保持日常实例运行于原版本。不要指向日常 `DSH_HOME` 运行候选 `web` 或 `install:plugin`；迁移校验不足时启动器会拒绝启动。

三层数据必须分开：原始一致性备份、仅离线读取的兼容副本、无凭据且所有路径均在临时目录内的运行样本。数据库使用一致性快照或停写备份。复制文件数相同不能证明备份一致或语义完整。

## 离线检查与转换

先复制一份已经验证完整的会话目录到独立目录。不得用活动目录充当离线源。目标目录必须不存在，且与源目录互不包含；父目录先行创建。

```sh
node scripts/audit-session-copy.mjs /isolated/offline-sessions /isolated/aggregate-report.json
node --input-type=module -e "import {migrateSessionCopy} from './scripts/session-migration.mjs'; await migrateSessionCopy('/isolated/offline-sessions', '/isolated/converted');"
```

PowerShell 可以同样调用这两个 Node 入口，使用完整 Windows 路径和单独的外层引号。报告位置在仓库外；原会话和原文映射包含私有内容，不能提交仓库或上传 CI。

转换输出：

- `migration.json`：源/目标核心、源代际、备份 ID、阶段、旧版可读性、`runnable:false`。
- `report.json`：会话 ID、父子关系、原文件摘要、目标摘要、事件数和变更映射。
- 每个会话目录保存原始压缩/明文、v4 明文、`qs-history.json` 和 `team-history.json`。
- 目录外持久化互斥锁防止两个进程同时转换。异常退出残留锁时，先确认原进程已结束，再由维护者处理；不按超时自动夺锁。

严格拒绝损坏压缩帧、截断 JSONL、未知格式、重复 ID、变化的源代际、被改写的目标和外部链接。原文件永不覆盖。原日志在多次解析前独立复制，避免上游 packed-chunk 解码的就地变更影响后续核对。

### 允许的格式变化

1. 官方格式链把旧 assistant chunks 规范化到新版 attempt 事件、补充有证据的子任务目录，并重新映射事件序号。因此事件数可能下降，不能按条数简单比较。
2. QS 0.1.36 的十种已登记元数据事件没有事件序号引用。转换器临时使用不产生执行效果的 log-only 元数据包络让官方链处理坐标，然后按持久关联还原原类型及原数据；临时包络不写入输出。原文、原/新序号与数据摘要一起保留。未来字段、未知类型及 surface 修改不在允许范围内。
3. Team 事件版本由 1 到 2；旧 `delivery` 字段保存在原文映射中，成员、任务、消息、发送者和接收者 ID 不变。使用目标版本真实 Team 投影验证。

核心官方事件仍由官方严格解码器校验。未知历史事件保留在原文件及错误证据中，不能为了迁移成功静默丢弃。未知 Team 类型另记录原文并报告。

### 旧团队消息

已投递回执或接收方持久化证据确认接收的消息不重发。完整接收方历史确认未接收才进入“待恢复”；历史不完整、矛盾或投递中断进入“待确认”。用户打开主团队会话，点击“旧团队消息”只做核对；再次点击“继续待恢复消息”才恢复原任务，可能调用已配置模型。

每次投递前写入持久化关联及 started 阶段；投递返回异常时先核对接收方，不盲目重试。普通启动、查看、归档恢复都不自动发送旧消息，也不补跑历史自动任务。

## 启动器过渡

1. 保留旧程序、原 Profile 和一致性备份，记录原提交、核心、端口和数据目录。
2. 单独安装协议 2 启动器。完整版本文件先写入版本目录，校验后只切换指针；中断目录不被当作有效安装。
3. 先用该启动器验证旧核心仍可运行。固定旧基线的独立 checkout 安装依赖后，从候选目录运行 `pnpm run ci:legacy -- /path/to/old-checkout`。脚本验证旧基线提交、在临时数据目录启动并清理；不会运行原数据目录。Windows 实测及 Windows/macOS/Linux CI 均已通过此项。
4. 只有完整迁移已验证，候选才能启动。父子握手核验本次启动 nonce、提交、核心版本、代际、迁移状态、制品摘要和服务就绪后才能激活。
5. 旧实例占用端口、错误提交、服务未就绪、未知状态和迁移中断都应停止；不扫描目录猜测版本继续运行。

## 回退

- 只有迁移记录明确 `oldReadable:yes` 且 `phase:validated`，才允许程序及 Profile 回退。
- v4 会话输出标记 `oldReadable:no`。旧核心不能直接读取这个副本；禁止改标记绕过。
- 恢复快照前先停止候选写入，保全升级后新增会话、交易记录、自建内容、配置及附件，生成校验清单。不要用旧快照覆盖唯一的新数据。
- 将已验证的旧一致性快照恢复到另一个目录，使用对应旧核心检查 ID、父子关系、消息、附件、自建内容、交易记录和配置，再安排人工切换。
- 自动清理遇到迁移记录时保留版本；迁移备份、回退所需版本及未处理增量不得删除。

### 离线保全与恢复工具

仅针对已经停写、具有一致性证明的离线目录使用；`backupId` 应填写校验过的原备份标识。文件前后两次校验不能替代数据库一致性快照，工具不会替你声明活动数据库已经安全备份。

```js
import { preserveAndRestoreCopy } from './scripts/offline-recovery.mjs'
await preserveAndRestoreCopy('/isolated/verified-old-home', '/isolated/stopped-candidate-home',
  '/isolated/recovery-output', {
    consistency: 'verified-offline-snapshot',
    backupId: '<verified-backup-sha256>',
  })
```

输出目录首次必须不存在。先写入并完整验证 `preserved-candidate/`，然后写 `restored-baseline/`；两个原目录均只读。每个文件以摘要校验，包含空目录及链接文本。链接不被遍历或执行。候选新增会话、成交、配置和附件保留在完整候选副本中；旧代际也保留，不能用旧文件覆盖新文件来“合并”。

独立 `migration.json` 与 `inventories.json` 记录两个代际、备份标识及阶段。中断可用同样参数重跑；已存在的每个文件须与源一致，变化的源、未知阶段、篡改输出、嵌套目录和并发恢复均拒绝。失败产物保留供检查，不自动删除。

构造样本的 7 项测试已覆盖恢复、新增记录保全、幂等、中断、锁、外部链接保护及关闭后的 SQLite 快照 `integrity_check` 和成交金额核对。**输出始终 `runnable:false`、`oldReadable:unknown`**：不能把该复制报告当作整个数据目录与旧核心兼容的证明；真实旧核心的离线读取已通过；原生旧核心恢复启动只在构造样本中验证。将来实际切换前仍须检查届时的 Profile 路径、删除日志及自动任务。

## 整目录迁移与语义核对

```js
import { migrateHomeCopy } from './scripts/home-migration.mjs'
await migrateHomeCopy('/isolated/verified-old-home', '/isolated/migrated', {
  consistency: 'verified-offline-snapshot',
  backupId: '<verified-backup-sha256>',
})
```

该工具先保存独立阶段日志，复制并验证整个目录，再执行会话转换，最后生成 `proof.json`。原文件原样保留；允许的新增仅为目标会话格式文件。逐一校验原文件摘要，并对 SQLite 做 `integrity_check`、schema/逐表行数/规范化内容摘要。SQLite 检查在另一个临时副本上进行；非空 WAL、未知格式、变化的源代际和篡改目标均拒绝。仅“文件数一致”不会通过。

`prepared` → `migrating` → `validated`；异常写为 `failed`，重跑前重新核验源和已产生内容。真实副本日志为 `runnable:false`，不能作为生产启动证书。`certifyIsolatedHome` 只接受路径隔离、无凭据、无执行任务且已先安装新启动器的构造样本，不接受原数据目录或真实兼容副本。

可重复的完整原生验收：

```sh
pnpm run ci:smoke -- --whole-home --legacy-market
node scripts/ci-optional-bundles.mjs
pnpm exec playwright install --with-deps chromium
pnpm run ci:smoke -- --whole-home --legacy-market --all-optional --browser-e2e
pnpm run ci:legacy -- /isolated/fixed-old-source --restore
```

`--all-optional` 只修改本次临时样本的选择。日常配置与新安装默认值不变。浏览器使用本机随机端口的模拟模型；该模型返回固定文本，不能证明外部模型能力。

真实旧代际的只读解析验证：

```sh
node scripts/verify-legacy-session-copy.mjs /isolated/fixed-old-source /isolated/recovery
```

先检查脚本参数和旧基线提交；只挂载旧版解析器与声明式 QS 事件目录，不启动完整 Host，不恢复任务，不发送消息。旧版展开事件数与新版转换事件数的口径不同；对比依据是保留原文、允许转换清单、ID/关联和规范化摘要。

## 插件来源迁移与中断恢复

实际 manifest、lock 和安装记录优先于目录推荐。npm 保留实际包名、精确解析版本和完整性；Git 保留固定提交与子目录；压缩包保留 URL、仓库归属及校验；本地链接保留语义及目标；来源不明者保留但禁止自动更新或替换。迁移成功后才撤下旧市场挂载；禁用者不会被自动启用。

官方管理器的修改操作按 Profile 加锁。新包在隔离 staging 中禁用安装脚本后解析真实名称，检查 QS 核心保护后才允许发布到 Profile；Git、压缩包和 npm 别名不能绕过名称检查。核心更新只能走应用升级。

如存在未完成事务，启动器拒绝启动或回退。停止本次候选进程后使用 `node scripts/recover-plugin-transaction.mjs --help` 检查参数，再按记录恢复原 Profile 和冻结依赖。工具核对记录、原文件摘要，同时取得 Profile 和启动锁；未知阶段和篡改不能通过。失败证据会保留，不能手删标记后启动。
