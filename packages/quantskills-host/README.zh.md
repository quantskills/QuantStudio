# @deepseek-ai/dsh-quantskills-host

[English](README.md) | 中文

目录资产 id 接受小写字母、数字、短横线和下划线，同时仍要求精确的 `skill-` 或 `agent-` 前缀并匹配官方仓库。Envelope、snapshot、taxonomy 与响应大小继续严格校验，但每个资产条目会独立准入：格式错误、来源替换、重复或其他无效条目只会被排除，不会导致全部有效资产不可用。

这是 QuantSkills 资产的可信 Host 投影、官方不可变安装器和私有本地创作发布者。`QuantSkillsHostGateway` 在 `quantSkills/catalog`、`quantSkills/catalogSyncStatus`、`quantSkills/list`、`quantSkills/applicationUpdateStatus`、`quantSkills/applicationUpdateCheck`、`quantSkills/applicationUpdateStart`、`quantSkills/assetReadme`、`quantSkills/install` 和 `quantSkills/agentTemplate` 下发布支持取消的 Typert Remote。Client 组合通过 [`api-remotes`](../../api/remotes/README.md) 挂载这些生成方法。同进程方法会解析一个精确且注册表可见的已安装 Skill，也会发布已验证本地草稿；版本缺失、类型不匹配或路径不在获授权草稿根目录内时会拒绝。

`catalog` 只获取 `https://raw.githubusercontent.com/quantskills/quantskills/main/site/catalog.json`，或同一路径在目录仓库某个精确 40 位十六进制 commit 上的版本。它限制完整响应大小，校验 snapshot id 与每项获批资产，排除未获批条目，并且只接受精确的 `https://github.com/quantskills/<asset-id>` 仓库；仓库的 40 位十六进制 commit 与根声明文件必须和 `skill` 或 `agent` 类型一致。它返回的 Client 安全快照包含发布方动态给出并稳定排序的中英文分类与子分类，以及摘要、说明、健康状态、校验等级、依赖和稳定的本地化显示元数据。有发布方中文标题时优先使用；否则 Host 根据资产 id 与中文摘要确定性地产生简短中文名，记录名称来源，并保留英文名、别名和原始资产 id 供搜索。结果绑定经过校验的资产 id 与 commit，不需要模型或页面渲染时请求。`list` 还会读取每个精确已安装声明的中文一级标题，使 Client 只对匹配 commit 优先使用该声明标题。浏览器无需再次拉取目录，也不需硬编码分类数量。完整校验通过的响应及其受限 entity tag 会保留在进程内存中。后续 Client 读取会立即返回这份可信快照，Host 同时在后台通过 `If-None-Match` 对它做条件重新校验；只有已校验缓存存在时才接受 `304`，重新校验失败也不会清空缓存。配置 `catalogEventsUrl` 后，Host 会维持一条出站 SSE 连接，并且只把每个获准目录事件当作重新请求该可信 URL 的提示；中继不能提供目录内容或安装源码。快照与 `catalogSyncStatus` 会暴露连接状态，Host 也会向 Client 发送目录和状态事件。没有中继时，默认五分钟的自动检查间隔仍作为回退。

`assetReadme` 只有在重新校验调用方观察到的目录快照、已批准资产 id 和精确 commit 后，才会提供该仓库根目录的 `README.md`。它按需获取对应的官方 GitHub raw URL，拒绝重定向和不匹配的响应 URL，执行独立超时与完整 UTF-8 字节限制，并且不会替换为其他分支或说明文件。README 缺失或无效只会让详情请求失败，不会改变目录批准或安装状态。

`install` 会重新获取目录，并要求调用方观察到的 snapshot id 和 commit 完全匹配，随后才会启动 Git。安装 Agent 时，它会合并安装获批目录依赖与标准 `AGENTS.md` 依赖；每个声明依赖都必须解析到同一快照中的获批 Skill 及其精确 commit。发布模板前，它会拒绝循环、缺失依赖和 Agent 到 Agent 的依赖。Git 只通过 `ctx.subprocess` 的 argv 运行，不继承凭据形态的环境变量，不读取系统或全局 Git 配置，禁用交互提示，使用空 hook 模板，只允许 HTTPS 传输，并在所有宿主平台上以 LF 检出文本。首次从 GitHub 获取资产的超时可配置，默认十秒；超时或 Git 失败后，Host 会把同一 origin 切换到同名 Gitee 仓库，并再次获取目录指定的精确 commit。调用方取消会停止完整安装，不会启动回退。随后 Host 检出精确 commit，拒绝符号链接、gitlink、submodule、不安全或冲突的路径及违反整棵树限制的内容，并用 Git blob id 验证每个检出文件。

应用更新完全由用户发起。只有 `applicationUpdateCheck` 会查询固定的官方应用仓库与 `main`，并且只比较提交，不克隆或安装。它报告 `available` 后，Client 必须再次取得用户确认，才能调用 `applicationUpdateStart`。随后 Host 才会克隆到托管暂存目录、安装锁定依赖、执行源码与隔离启动验证，并为稳定启动器记录经过验证的 `pending` 版本。Host 初始化不会执行这项检查；准备失败不能替换当前运行版本，也不能修改用户数据。

通过校验的官方源码会原子发布到 `<DSH_HOME>/quantskills/versions/<asset-id>/<commit>/source`，本地创作则发布到 `<DSH_HOME>/quantskills/authored/<asset-id>/<commit>/source`。两类存储复用同一套安全目录树验证、本地 Git 快照、原子发布和私有清单格式。清单会记录 `origin: "catalog" | "local-authoring"`、身份、声明文件、树摘要、完整大小和发布时间。`list` 只读取这些清单，因此浏览器缓存和 Client 状态无法制造已安装事实。官方安装仍要求目录来源；本地创作会拒绝与官方资产冲突的 id，并且绝不会修改或推送源仓库。Skill 声明必须能解析为标准 DSH Skill，其名称可以等于资产 id，也可以只去掉开头的一个 `skill-` 前缀；其他别名不会被接受。本包的 provider 通过 `ctx.skills.list()` 与 `ctx.skills.get()` 暴露声明名称，并把最新的已提交不可变源目录作为 `resourceBase`。Agent 声明必须使用标准根目录 `AGENTS.md`，名称必须等于资产 id，并且只能引用精确已安装 Skill 依赖。`agentTemplate` 会为显式导入暴露有界指令正文和依赖 id，绝不会把它加入 Skill 注册表。

Host 在解析声明时会独立识别第一个围栏 `json qsh-form` 块，把它作为可选的版本一参数元数据。它支持可选任务、最多十二个 `text`、`textarea`、`select`、`date` 或 `number` 字段、默认值、固定选择项和一个 `prompt_template`。受控 Mustache 模板中只能出现已声明字段名以及保留变量 `task` 与 `attachments`。严格校验前，确定性的兼容适配器只会转换 `number` 字段默认值中符合规范且有限的 JSON 数字字符串，并向 Client 报告每项转换。不支持的标签、格式错误的 JSON、有歧义的值、无效字段和未声明变量会产生 `invalid` 表单结果，而不会拒绝安装或改变声明正文。适配器不会调用模型，也绝不会转义、改写或删除上游 Skill 或 Agent 文本；Session 组合会通过系统提示词 literal 通道注册这份完整文本。

Loader 配置控制官方目录 ref、可选的事件中继 URL 与重连间隔、目录、README 和首次 GitHub 资产获取超时、自动检查间隔、目录、README 与 Git 输出限制、Git 可执行文件与终止宽限，以及文件数量、累计字节、单文件、深度和路径字节限制。配置后的目录 URL 仍必须符合官方 URL 语法。事件中继必须使用 HTTPS，本地开发的回环 HTTP 除外，并且必须返回不经重定向的 `text/event-stream`；两个设置都不能放宽仓库所有者或安装传输策略。

## 模型体验

间接影响，通过现有 Skill consumer 加载精确的已提交声明，并记录渲染后的指令或工具结果；安装和表单解析本身不会增加模型输入。之后加载声明时，`qsh-form` 围栏仍属于原始声明的一部分。

#### KV Cache 影响

在选择已安装 Skill 前没有影响。Skill 正文进入请求后，它与其他 DSH Skill 一样会改变模型可见前缀。

## 已知限制与暂缓事项

- **Agent 模板需要显式导入**——安装会校验并暴露 `AGENTS.md`，但只有 Client 导入该模板时才创建由用户持有的可编辑 Agent 定义。
- **没有无人值守 Skill 安装**——自动检查只刷新已批准的目录投影。普通 consumer 使用的全局 provider 会选择每个 Skill 最新的已提交版本，因此安装新版仍需用户明确点击；精确版本 Session 则直接解析日志记录的版本。应用版本检查和准备分别由用户发起。Skill 的显式回滚、感知引用版本的移除和垃圾回收仍待实现；部署必须保留 Session 日志引用的每个 Skill 版本。
- **目录真实性依赖官方 HTTPS 发布**——本包校验来源、schema、snapshot 语法和资产来源，但目录 envelope 尚无独立签名。
- **实时推送需要外部中继**——GitHub 无法直接推送到位于 NAT 之后的本地 DSH 进程。GitHub webhook 或 Action 必须通知已配置的出站 SSE 中继；没有该部署时，Host 会使用焦点与定时重新校验。
