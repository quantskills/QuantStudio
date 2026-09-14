# `@deepseek-ai/dsh-quantskills-session`

[English](README.md) | 中文

由 Host 持有的 QuantSkills Skill、用户 Agent 与 Agent Team 会话精确版本组合服务。该服务在 `quantSkillsSessions` 下发布 Skill 会话、Agent 定义、Agent Team 定义和独立存档方法，QuantSkills 组合包会把它与不可变安装器一同挂载。每个会话都是具有独立 Agent、上下文、日志、标题、fork 血缘和归档生命周期的普通 DSH Session；多个 Session 可以独立并行运行，同一个 Skill、用户 Agent 或 Agent Team 也可以拥有多份已保存会话。

同一个 Remote 还持有原生插件的 Workspace 目标。`workspaceStatus` 只读：它报告可选的首选已注册 Workspace 和托管路径，不创建目录或注册记录。`workspaceResolve` 会采用可用的首选 Workspace，或者在首次创建 QuantSkills Session 时才准备托管默认目录。Windows 与 macOS 的托管默认目录位于操作系统解析出的 Documents 目录下 `QuantSkills`，Linux 使用 `${XDG_DOCUMENTS_DIR}/QuantSkills`，未设置文档目录时使用 `~/QuantSkills`。解析过程使用 single-flight，把规范化路径作为身份依据，采用已有目录而不修改其中内容，自动重建缺失的目录或注册记录，并在其他路径已经使用 `QuantSkills` 名称时分配确定性的编号名称。它不会把 DSH 进程工作目录作为隐式回退。卸载应用插件会保留 Workspace、Session 和用户文件，已有 Session 继续使用其日志记录的 Workspace。

`plainSessionCreate` 是普通 QuantSkills 对话和临时 AI 辅助对话的 Host 入口；这些对话尚未冻结 Skill、Agent 或 Agent Team。调用方必须明确提供 `ordinary` 或 `role-helper` 用途；角色说明生成和目录匹配共用不会显示在存档中的 `role-helper` 路线。setup 会在发布前追加唯一一条 `quantskills/plain-session` 归属事件。`quantSkillsPlainSession` 投影会在冷启动后恢复该用途，因此存档、结果工具、附件和 PandaData setup 可以区分产品自有对话与原生 DSH Session，而不依赖标题、当前路由或浏览器状态。相同 SessionId 与相同用途的重试是幂等的；不同用途、其他 QuantSkills 组合或原生已有 Session 都会产生冲突。

`create` 要求调用方预先分配 `SessionId`，并提供一个由 Host 签发的已安装版本 id。它会先从 `dsh-quantskills-host` 解析该版本，再保留这个会话身份，随后把创建操作交给标准 API Proxy。API Proxy 会在 Agent 与 Session 尚未发布时组合已注册的 Host contributor。本包安装一个只包含精确已解析 Skill 的作用域 provider，并在发布前追加唯一一条必需的 `quantskills/session-bound` 事件，不存在先创建再绑定的间隔。发布校验会按 Skill 声明名称解析，并分别检查固定 provider、声明路径与资源目录；因此，资产 id 带有 `skill-` 前缀的标准仓库仍保留精确绑定，而不会成为第二个注册表名称。相同 SessionId 与相同绑定的重试是幂等的；普通已有 Session 或不同绑定会产生冲突。

全新创建、冷恢复和 API fork 都使用同一条未发布 setup 路径。恢复与 fork 会从日志折叠绑定并重新解析这个准确的已安装版本，绝不会选择安装器当前最新版本。版本缺失、损坏或属于 Agent 模板时，setup 会在 Agent 进入任一注册表之前拒绝。目录 Agent 模板会导入用户 Agent 定义，而不会进入这条单 Skill 路径。会话事件记录 `assetId`、`versionId`、准确 commit 和已验证树摘要，使作用域模型能力可以从持久历史中重建。

`quantSkillsSession` 投影折叠这条唯一绑定事件，对所有普通 Session 或功能上线前的 Session 返回 `null`。`list` 合并实时和已持久化 header，读取实时投影或冷投影重放，默认排除 subagent 会话与已归档 Session，并且只返回已绑定会话。每一行都会根据实时 Agent 和最后一条持久 Turn 结束事件投影 `idle`、`running`、`failed`、`cancelled` 或 `completed`。`frequent` 按资产 id 聚合这些真实归档行；浏览器缓存和 local storage 都不能生成使用历史。传入 `includeArchived: true` 可包含已归档行，`frequent.limit` 限定为 1 到 100。

`quantSkillsResidentSkills` 投影会把不可变的 Skill 或 Agent 基础组合与之后的 `quantskills/resident-skill-changed` 事件一起折叠。`residentSkillAttach` 与 `residentSkillDetach` 按 Session 串行化变更，只能操作实时 QuantSkills Session，并返回权威的当前列表。加载操作会先解析精确已安装版本，再注册其作用域 provider，并把完整声明注册为设置了 `interpolation: "literal"` 的系统提示词段。因此，`{{task}}` 等标准 Skill 模板语法、Mustache 条件和未知双花括号名称都会保持不变，不会进入 DSH 变量解析。卸载操作会在事件追加成功后移除区段和 provider。两种操作都不会创建用户消息。冷恢复与 fork 会重建相同的当前列表和渲染策略；日志记录的版本无法解析时，setup 会在发布前失败。把同一资产换成另一版本时，必须先明确卸载再加载。

用户 Agent 定义由 Host 保存在 DSH home 目录下，并通过带版本号的 `agentList`、`agentCreate`、`agentUpdate` 和 `agentDelete` 方法提供。定义包含名称、不超过 128,000 个字符的角色、动态或固定编排方式、可选模型选择、明确的权限预设、可选来源 Agent 模板版本，以及按顺序排列的零到 32 个精确已安装 Skill 版本。零 Skill 定义是使用 Session 基础能力的角色型 Agent。更新和删除必须携带调用方看到的 revision；重复 Skill 会被拒绝；删除定义不会影响既有 Session 的重建。

`agentSessionCreate` 会保留一个全新的 Session 身份，解析每个精确版本，并复用同一条未发布 API Proxy setup 路径。发布前，setup 会注册完整的作用域 Skill 组合，把用户定义的角色与编排策略加入系统提示词，并追加唯一一条必需的 `quantskills/agent-session` 事件，其中包含完整的不可变定义。Agent Session 使用独立的 `quantSkillsAgentSession` 投影和 `agentSessionList` 归档方法，绝不会伪装成某一个 Skill 绑定。即使可编辑定义已经删除，冷恢复仍能从日志快照重建角色和所有 provider。

Agent Team 定义使用第二份带 revision 的 Host 文档，并提供 `agentTeamList`、`agentTeamCreate`、`agentTeamUpdate` 和 `agentTeamDelete`。一份已保存 Team 会冻结一个 Lead Agent 与一到八个互不相同的成员 Agent，包括每个 Agent 的角色、执行设置和精确 Skill 版本。成员名称必须是除 `lead` 外互不重复的 lower-kebab-case 值；同一个 Agent 不能占用两个角色。由于 DSH 可继续执行的 teammate 会继承 Lead 运行时，每个成员必须使用与 Lead 相同的模型、推理设置和权限预设。每个成员可独立选择 `fresh` 或已完成前缀的 `fork` 上下文。修改来源 Agent 不会改变既有 Team revision；删除 Team 定义也不会影响其 Session 日志重建。

`authoringSessionCreate` 会创建独立 workspace-write Agent Session，并原子追加类型为 `skill`、`agent` 或 `agent-team` 的 `quantskills/authoring-started`。Setup 根据该事件而不是 Agent 显示名称注册工具。Skill 与 Agent Session 会获得 `quantskills_asset_draft`：`list-skills` 返回可绑定的精确版本，`prepare` 使用共享安装器规则验证 `quantskills-drafts/` 目录树、解析运行要求，并返回写入日志的规范化摘要。Agent Team Session 会获得 `quantskills_team_draft`；其 `list-agents` 与 `prepare` 动作返回精确 revision 和诊断，不提供修改路径。普通 Agent Session 不会获得这两个工具。Client 明确确认时会使用成功 tool call id 与预期摘要调用 `authoringCommit`。Host 会重放 Tool Result、校验创作类型、重新读取和验证草稿，执行幂等 Skill、Agent 或 Team 提交，并追加唯一的 `quantskills/authoring-committed`。Client 冷恢复后会用该事件恢复已保存状态，重复点击也不会创建重复资产。

每个 QuantSkills 创建入口都会在发布工作前执行同一套 Panda 预检，包括普通插件对话、Skill、Agent、Agent Team、创作、测试和角色辅助 Session。预检要求凭据重放通过鉴权、有界只读数据调用成功，并完成一次有界执行探针；随后解析一个兼容托管 Panda 运行时，并追加带环境 id、SDK、Python 与 API 指纹的 `panda/runtime-bound`。热插拔会检查既有绑定，不会静默更换；Team 的全部精确成员组合必须使用一个兼容绑定。作用域 `quantskills_panda_python` 工具会通过标准 subprocess 与 sandbox 能力启动已绑定私有 bootstrap。凭据只通过 stdin 进入；脚本必须位于 Session Workspace 或精确绑定资产内，产物只能留在 Workspace 中。原生 DSH Session 不执行该预检，也不会获得 Panda 工具。

`agentTeamSessionCreate` 会在 Lead 发布前，把完整 Team revision 冻结到唯一一条必需的 `quantskills/agent-team-session` 事件中。它安装 Lead 角色和精确常驻 Skill，然后把 `activate_team_member` 暴露为唯一成员创建入口。该工具只接受一个已声明成员名，保留 child Session 身份，并让原生 `ctx.agentTeams` 服务按冻结的成员角色、精确 Skill 版本和声明的上下文模式启动可继续执行的 child。成员发布前会收到唯一一条必需的 `quantskills/agent-team-member` 事件。QuantSkills 组合不提供通用模型工具 `spawn_teammate`，因此模型不能凭空创建未声明成员；原生 roster、持久 mailbox、等待、中断与共享任务 DAG 工具继续可用。重复激活同一成员会失败，后续执行使用 `followup_task`。

Team Lead 存档使用独立的 `quantSkillsAgentTeamSession` 投影和 `agentTeamSessionList` 方法。成员 Session 仍是原生 subagent child，不会出现在顶层 Team 存档列表。冷恢复会从已记录快照重建 Lead；再次激活成员时会从该成员已记录快照重建 child。已保存定义的 revision 检查保护编辑，而 Session 创建与重试比较完整的冻结 Team 组合。

`promptFormList` 只会投影属于目标实时 Session 的精确版本所带可选 `qsh-form` 元数据，包括当前常驻 Skill、来源 Agent 模板，以及冻结在 Team Lead 或成员中的来源模板。`promptFormRender` 会再次检查这项授权，校验任务和字段值，取得真实 Session 附件列表，并在 Host 中用 `mustache` 渲染获准模板。其 view 只包含基础值，不启用 lambda 或 partial，并关闭 HTML 转义，因此结果是纯用户文本。Client 可以通过普通 Session 提示词路径提交该文本，并把它记录为正常用户消息。无效的可选表单仍可列出用于诊断，但不能渲染，也绝不会阻止安装、自然语言对话、热插拔、fork 或冷恢复。

`fileAttach` 通过通用附件 seam 解码规范 base64，按 Session 串行化上传，执行存储服务的 Session 累计预算，提交不可变对象，随后追加一条 `quantskills/file-attached` 归属事件；事件只包含引用、解析状态与时间戳。大小不超过 `maxTextAttachmentBytes`（默认 1 MiB）的 UTF-8 文本会标记为 `ready`；不超过 `maxDocumentAttachmentBytes`（默认 25 MiB）的 PDF、DOCX、ODT、PPTX、ODP、RTF、EPUB、XLSX 和 ODS 文件会进入文档解析。`fileList` 与 `fileRead` 强制检查 Session 归属。文档读取使用关闭 OCR 和嵌入附件提取的 `officeparser`，随后按文本上限截断提取出的 UTF-8。每个 QuantSkills Skill 或 Agent Session 都会获得作用域 `quantskills_read_attachment` 工具，并且只公开解析成功的文本。上传原始 base64、无效结构与猜测的二进制内容都不会进入 Session 日志或模型请求。

`resultPrepare` 会在结果路径进入工作台前进行分类。已经位于目标 Session 工作区内的普通文件会成为使用规范工作区相对路径的 `ready` 结果。工作区外的旧路径可以归档的前提是：Host 证明它位于该 Session 的 Skill、Agent、Team Lead 或 Team 成员组合所授权的精确 QuantSkills 已安装版本 `source/output/` 下，或者该 Session 的持久日志记录了成功的 `skill` 工具结果。后一种路径还必须使工具结果中呈现的资源目录匹配一个精确的已安装 registry Skill；Session 未加载的其他已安装版本仍然不可用。其他外部文件只有在完整持久 Session 日志记录了一次成功变更 Tool 调用，并且该 Tool 的纯 `presentCall` 视图精确声明了该路径时才可以归档。Host 会把旧 Skill 产物复制到 Session 工作区内的 `output/quantskills/<asset>/<commit>/<relative>`，把已证明的外部变更产物复制到 `output/quantskills/session-files/<path-digest>/<name>`。它只返回归档后的工作区路径，绝不会直接预览外部源文件。路径不存在、目录、符号链接、路径穿越、无关已安装版本、只有 Assistant 提及的路径、失败变更和其他所有外部位置都会返回带有用户可读原因的 `unavailable`。

`resultList` 从完整持久 Session 日志恢复产物归属，不依赖浏览器已经加载的历史分页。它识别安全的 Assistant 行内代码路径，以及各 Tool 纯 `presentCall` 视图声明的成功变更路径，按最新引用优先去重，把请求限制为 100 个候选，并让每个候选继续经过 `resultPrepare`。失败调用、读取／删除／终端展示、无法解析的历史参数、不支持的扩展名、命令、路径穿越和任意自然语言都不会成为产物。

`resultPreview` 只读取目标 QuantSkills Session 工作区内的普通文件，包括已经由 `resultPrepare` 归档到该处的旧 Skill 产物和已证明的外部变更产物；它绝不会直接读取已安装版本路径或其他外部路径。它返回 Markdown、HTML、表格文本以及常见源码与配置扩展名的有界 UTF-8 文本；从 DOCX、ODT、PPTX、ODP、RTF、EPUB、XLSX 与 ODS 文档提取出的有界文本；或经过签名校验的 PNG、JPEG、GIF、WebP 与 PDF 字节；`maxResultPreviewBytes` 默认为 2 MiB。文档提取使用关闭 OCR、嵌入附件提取与原始 XML 的 `officeparser`。不支持的扩展名、错误签名、无效 UTF-8、解析失败与已知过大文件会返回明确的 unsupported 结果，而不会推断内容。

组合实盘下单工具的部署必须在 `liveTradingToolNames` 中列出准确的 DSH 工具名。配置的名称不可用时，Session setup 会直接失败。每次匹配的 Tool 调用都会从作用域执行前策略返回 `ask`，因此标准审批服务会记录一份新决定，并且只有 `allowed-once` 能进入工具主体；此前的允许不能授权之后的订单。本包不提供券商或交易执行器，空列表不会启用实盘交易。

每个 QuantSkills Session 还会收到一段作用域运行说明：PandaData 是默认数据源。PandaData 失败时，数据任务必须停止并返回修复操作；除非当前用户明确指定，模型不得自行改用 AkShare、Yahoo、Tushare 或其他来源。用户的明确指定只对当前任务生效，不改变 QuantSkills 默认设置。

## 模型体验

该包通过每个常驻 Skill 的作用域 Skill 注册表与精确 literal 声明区段、用户 Agent、Team Lead 和 Team 成员 Session 的 literal 角色区段、附件读取工具、PandaData 运行说明、产生普通用户文本的参数表单，以及配置下单工具时加入的实盘安全区段间接影响模型。

#### KV Cache 影响

每个当前常驻 Skill 都会把其精确声明按原文加入 Session 专属请求前缀。因此，加载与卸载事件会改变之后的请求，却不会增加会话消息；常驻集合稳定时，该前缀可跨轮次复用。用户 Agent 已记录的角色会增加另一个稳定的 literal Session 专属区段；修改可编辑定义只影响之后新建的 Agent Session。Team Lead 与成员分别获得其冻结 literal 角色和精确 Skill 前缀；Lead 还会获得由声明控制的激活 schema 与原生 Team 协作策略。附件与实盘交易说明会增加稳定的作用域前缀；读取受支持附件或提交已渲染参数表单会增加普通的仅追加 Turn 内容。

## 已知限制与后续工作

- **Agent 模板会变成可编辑定义**——导入目录 Agent 时会保存其获批且已安装的 Skill 依赖；后续目录更新不会改写用户定义或既有 Session。
- **定义使用 Host JSON 文档**——同级文件锁会串行化多个 Host 进程的写入；遗留锁需要运维人员先确认没有写入方存活，再手动恢复。
- **Team 成员共享权限与工作区运行时**——一个 Team 可以组合不同角色、Skill 集与显式模型策略。每个角色可以跟随 Session 默认模型，或冻结自己的 provider、model 与可选推理强度；权限预设、工作目录和文件系统仍共享。写入范围通过 Team 任务协调，而不是由独立 sandbox 隔离。
- **已安装版本由外部保留**——本包绝不会升级已有会话，也不回收版本；安装器必须保留 Session 日志引用的每个版本。
- **文档解析排除 OCR 和嵌入附件**——文本型 PDF 与受支持 Office 容器可读取；扫描文档与嵌入载荷仍是持久原件，需要另一个显式工具处理。
- **本包不提供交易 provider**——`liveTradingToolNames` 保护显式组合的 DSH 工具；本包不会发现 shell 或代码执行中的任意交易行为，也不会自行提交订单。
- **本包不包含浏览器 presenter**——它提供类型化 Host Remote 与投影真相；标签页、并行运行呈现、归档控制和结果抽屉属于 QuantSkills Client。
