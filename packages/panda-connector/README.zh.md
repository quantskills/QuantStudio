# @deepseek-ai/dsh-panda-connector

[English](README.md) | 中文

Web 应用的 Host 侧 PandaData 鉴权与托管运行时。该包注册 `ctx.pandaConnector`，通过生成的 Typert Remote 提供环境检查、版本检查、安装、更新、修复、回滚、登录和登出，并通过 `ctx.subprocess` 在一次性私有 Python worker 中执行每个 SDK 操作。

## 托管运行时

连接器拥有 `$DSH_HOME/runtimes/pandadata`。每次安装都会创建一个新的不可变环境，记录 Python 与 PandaData 版本、公开函数指纹、必需能力标记和创建时间；只有候选环境通过校验后才会切换 `active.json`。活动环境不会被原地修改。只有一次成功激活替换了已验证活动环境后，才会产生可回滚目标；首次激活没有回滚版本。更早的保留环境继续隔离保存，供已经引用它们的 Session 使用。

连接器构造时只检查活动环境；存在 OS 凭据库记录时会在新 worker 中重放凭据，它本身不会安装或更新软件。QuantSkills Client 在应用挂载后发起一次幂等准备：没有活动环境时才创建环境，已有活动环境时只检查兼容更新。版本检查读取配置的 HTTPS PyPI JSON 端点，只接受与固定兼容矩阵中的精确通用 wheel URL 和 SHA-256 摘要一致的发行版本。候选环境必须提供全部必需的鉴权、行情、指数和融资融券能力；更新还必须保留活动 SDK 暴露的所有公开函数。下载、安装、凭据重放、有界读取或执行探针失败时，`active.json` 保持不变，Host 会返回精确且可安全展示的错误码，并删除未提交候选。运行时检查还会删除名称证明属于连接器且未被引用的候选目录；活动、回滚和 Session 保留环境绝不会成为清理目标。Host 会在普通检查和版本检查期间保留最近一次操作失败，只有对应操作成功后才会清除。

显式配置的绝对 Python 路径始终具有最高优先级。否则连接器依次检查 Host 当前的 `VIRTUAL_ENV`、QuantSkills 项目根目录中的 `.venv`、`.ven`、`venv`，最后检查配置的启动器名称。Windows 解析 `Scripts/python.exe`，macOS 与 Linux 解析 `bin/python`。选中的解释器必须满足 SDK 兼容范围，并且只用于创建连接器自有的不可变运行时；连接器不会向发现的项目虚拟环境安装 PandaData。本地启动器均无法解析，或者选中的解释器版本不受支持时，连接器下载平台对应的固定 `uv` 压缩包，校验固定 SHA-256 摘要，并通过 `UV_PYTHON_INSTALL_DIR` 在连接器自有运行时目录中安装 Python 3.12；它不会运行在线安装脚本、修改 PATH 或修改系统 Python。同一兼容记录把 PandaData 0.0.14 固定到准确的通用 wheel URL 和 SHA-256 摘要。平台不受支持或校验后的下载失败时，会明确报告 `python-unavailable`。

只有激活文件不存在时，连接器才会尝试接管已有的 `$DSH_HOME/runtimes/panda-data-0.0.12` 环境，并且其已安装发行版本必须与记录的旧版本一致。格式损坏、版本不支持或路径越界的激活文件会明确失败，不会回退到旧环境。

## 鉴权

`login` 接受显式的账户联合类型：

- `phone`：包含 `countryCallingCode` 和 `nationalNumber`；省略电话区号时默认为 `+86`，清除本地号码中的可视分隔符，并按 E.164 长度检查组合后的值。
- `email`：去除首尾空白并校验为电子邮件地址，不添加电话区号。
- `username`：仅去除首尾空白后原样传递，不添加电话区号。

密码只存在于 Remote 请求，以及发给私有 worker 的一份一次性 stdin JSON 文档中。密码绝不会进入 argv、环境变量、临时文件、Cordis 设置、Session Event、连接器状态、日志或遥测。响应只包含固定的错误码／消息和安全 SDK 状态；既不反射上游异常正文，也不反射账户标识。

连接器会把规范化账号与密码重放材料保存到操作系统凭据库：Windows Credential Manager、macOS Keychain 或 Linux Secret Service。凭据库不可用时，成功登录只在本次 DSH 运行期的 Host 内存中可用，UI 会明确显示这一限制。网络失败会保留凭据供重试；凭据被服务拒绝时则会删除并要求重新登录。

用户明确登录时，worker 会调用 `panda_data.init_token`、验证 `is_authenticated()`、执行兼容矩阵指定的有界只读行情调用，并通过托管 sandbox 与私有 bootstrap 完成一次有界脚本执行探针；全部成功后才保存凭据。鉴权、数据和执行就绪彼此独立：“已连接”只表明凭据重放通过鉴权，QuantSkills 任务还必须在活动环境中通过有界读取与执行探针才能开始。启动、窗口聚焦、网络恢复和每个 QuantSkills Session 预检都会在新 worker 中重放 OS 凭据并恢复这些就绪检查，但不会安装或更新软件。每个登录 worker 与 `quantskills_panda_python` runner 退出前都会调用 SDK 声明的 `clear_auth()`，因此 SDK 生成的 `user.json` 不会成为第二份凭据库。登出会删除凭据库记录并清理全部保留 SDK 环境，但不声称撤销服务端 token。

执行探针与 `quantskills_panda_python` 使用标准 sandbox 能力返回的隔离结果。可信后端可以报告 `full` 或 `partial`；连接器会记录后端与实际级别并提供给 Client，不会把 `partial` 升格为 `full`。因此 Windows ACL 隔离以 `partial` 级别执行，macOS Seatbelt 与 Linux bwrap 或 Landlock 则报告实际级别。后端缺失、隔离操作失败或 Python 启动器不可用时，连接器会返回 `execution-unavailable` 并停止任务，绝不会启动未隔离的备用进程。

所有生命周期操作共用一条串行队列。取消或 dispose（资源释放）会终止活动工作，通过 `ctx.subprocess` 终止受管进程树，等待进程树退出，并在完成前排空队列。

## 配置

Cordis 插件接受 `pythonCommand`、`pythonArgs`、`managedPythonVersion`、`dshHome`、`baseURL`、`releaseIndexURL`、`releaseTimeoutMs`、`operationTimeoutMs`、`bootstrapTimeoutMs`、`terminateGraceMs` 和 `maxOutputBytes`。`baseURL` 默认为 `http://pandadata.pandaaiquant.com`，`releaseIndexURL` 默认为 PandaData 的官方 PyPI JSON 端点，托管 Python 默认为 `3.12`。URL、时长、输出上限和解释器设置都在插件加载时校验。QuantSkills 组合包挂载 Host 服务，[`api-remotes`](../../api/remotes/README.md) 挂载其生成的 Client 贡献。

## 模型体验

无，因为这个纯 Host 连接器不添加工具、提示词、消息或模型提供方请求。

#### KV Cache 影响

鉴权与运行时状态不会进入模型输入。Client UI 只调用 Remote 方法。每个 QuantSkills Session 都会记录精确运行时绑定，并通过 `quantskills_panda_python` 执行已授权脚本；凭据只经 stdin 进入私有 bootstrap。原生 DSH Session 不会获得该绑定。

## 已知限制与延期工作

- **Linux 凭据库可用性** — OS 持久化需要可用的 Secret Service。没有该服务的无头 Linux 环境会使用仅当前运行期的 Host 内存，并在 DSH 退出后要求重新登录。
- **读取与执行验证需要服务权限** — 首次明确登录只有在兼容矩阵读取和有界脚本探针都完成后才会保存。网络、账号权限、sandbox 或 Python 失败会保持当前运行时不变，并且不留下已保存凭据。
- **Windows 隔离级别为 partial** — 标准 Windows ACL 后端无法完全隔离 Everyone 可写路径或 NTFS 硬链接。连接器会如实显示该级别；后端本身不可用时仍会失败关闭。
- **没有服务端 token 撤销** — SDK 的登出操作只会清除本地鉴权状态。PandaData 没有公开有文档说明的撤销端点，因此连接器不会声称撤销服务端 token。
