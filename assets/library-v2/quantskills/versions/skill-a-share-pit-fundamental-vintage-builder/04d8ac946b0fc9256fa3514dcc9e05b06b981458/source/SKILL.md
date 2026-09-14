---
name: skill-a-share-pit-fundamental-vintage-builder
description: Use when building or auditing A-share financial-factor backtests that must avoid look-ahead bias from current or restated financial reports. Produces historical as-of financial datasets for rebalance dates and verifies whether factor/backtest inputs used only information tradable at the time.
quantSkills:
  category: tooling
  tags:
    - a-share
    - pit
    - financial-data
    - look-ahead-bias
    - pandadata
  platforms:
    - claude-code
    - codex
    - openclaw
    - cursor
  status: active
  requires: []
  summary_zh: "构建并审计 A 股财务因子 PIT 输入，避免财报披露时点与后续修订造成前视偏差。"
  summary_en: "Build and audit A-share PIT financial inputs to prevent look-ahead bias from report availability and restatements."
  license: GPL-3.0-only
  validation_level: listed
  maintainer_type: community
---

# A 股财务因子回测防前视助手

## 社区项目声明

这是由仓库贡献者维护的 QuantSkills 社区项目，不是 QuantSkills 官方、认证、验证、背书或生产就绪项目。它只处理 A 股正式财报的 PIT 数据构建和财务输入的前视偏差审计；不执行通用因子收益回测，也不提供投资建议。

任何实时数据请求或公开发布前，先阅读 [references/research-boundaries.md](references/research-boundaries.md)。该文档定义 Panda Data 的数据来源与权限边界、PIT 假设和参数、已知限制以及仅用于研究的风险边界。机器可读的上游声明位于 [skill.yml](skill.yml)。

## 核心目标

回答一个量化研究问题：**策略在过去某日调仓时，财务因子是否只使用了当时已经公开且可交易的财报？**

当答案未知时，构建 PIT 财务因子数据集；当用户已有数据和代码时，审计已有回测。不要用本 Skill 解读最新财报、推荐股票或做泛化的公司研究。

## 首次交互

在新用户会话开始时，先展示下面的用户入口提示。展示前不要请求认证，也不要打开登录终端。

```text
这个 Skill 用来确认：你的 A 股财务因子回测，有没有偷看未来财报。

【1. 构建可信回测数据】
给我股票代码、回测期间和调仓频率。我会为每个调仓日还原当时可用的财报，再自动计算因子。
示例：“为 000021.SZ 和 600519.SH 构建 2021-2025 年按月调仓的财务因子回测数据。”

【2. 审计已有回测】
给我财务面板、调仓日和因子/回测代码。我会检查修订财报泄漏、未来函数和缺失快照。
示例：“审计 D:\data\panel.csv、D:\data\rebalance.csv 和 D:\strategy\factor.py。”

PIT 是这里的保护规则：每个历史调仓日只使用当时已公开、并在下一交易日可使用的财报。单季、TTM 和 ROA 等只是自动生成的回测因子，不是你需要先掌握的概念。
```

让用户选择“构建”或“审计”。只有第一次需要请求实时 Panda Data 时，才启动平台对应的登录流程。不要要求用户在对话中粘贴凭据，不要记录凭据，也不要把凭据写入命令。若已验证的凭据可从平台凭据存储中读取，除非用户要求更换凭据或认证请求失败，否则不要再次打开登录窗口。

执行前按请求类型路由：

1. 对“构建”请求，确认股票代码、起止期间，以及调仓日 CSV 或调仓频率。按月调仓时生成每月最后一个交易日；随后构建 PIT 数据、派生因子并验证结果。仅在没有有效凭据时启动登录流程。
2. 对“审计”请求，要求提供因子输入面板、调仓日 CSV，以及 Python 因子或回测文件。只有面板的审计只能检查数据时点，不能证明完整策略没有泄漏。除非用户要求与源数据交叉验证，否则不需要登录 Panda Data。
3. 将财报版本时间线作为高级诊断，而不是主要入口。

收集完审计文件后运行确定性审计：

```powershell
python scripts/audit_backtest_input.py `
  --panel inputs/pit_factor_panel.csv `
  --rebalance-dates inputs/rebalance_dates.csv `
  --factor-code strategy/factor.py strategy/backtest.py `
  --output outputs/backtest_audit.json
```

面板可以包含多个 `as_of_date` 分区。审计要求每个分区中，每个 `(symbol, quarter)` 只保留一个版本，并要求每个计划调仓日都有对应的面板快照。对 `is_latest=True` 和负数 `shift` 报确定性错误；`bfill` 与向前的 `merge_asof` 仅作为警告，仍须结合策略语境复核。

## PIT 约定

以 `panda_data.get_fina_reports(is_latest=False)` 作为首次披露版本的事实来源。它保留同一报告期的多个版本，并提供 `quarter` 和 `date`。

只构建**正式财报**的 PIT 层。业绩预告和业绩快报在纳入前，需要单独验证其历史版本可得性。

## 核心规则

对每个研究日期 `T` 和报告期 `(symbol, quarter)`：

1. 通过 `is_latest=False` 获取所有保留的财报版本。
2. 只保留 `disclosure_date <= T` 的版本。
3. 将每个披露日映射到下一个交易日。该保守的 T+1 规则避免假设公告在披露当日盘中已经可交易。
4. 只保留 `available_date <= T` 的版本。
5. 对每个 `(symbol, quarter)` 选择剩余版本中最新的一个。

历史回测输入绝不可调用 `is_latest=True`。它会选择今天所知的最新版本，可能引入财报修订偏差。

## 快速开始

展示首次交互示例后，在第一次实时查询前打开交互式登录终端。终端会隐藏密码；若账号不以 `86` 开头会自动补全；随后验证账号和一条小型 Panda Data 请求；将已验证凭据保存到操作系统的用户凭据存储；成功后 3 秒自动关闭。成功窗口会提示用户返回 Skill 对话并选择“构建”或“审计”。认证或连通性失败时，窗口保持打开，供用户再次尝试。

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/open_panda_data_login.ps1
```

macOS：

```bash
bash scripts/open_panda_data_login_macos.sh
```

Windows 将凭据保存到当前用户环境变量；macOS 保存到登录钥匙串。构建器兼容 `PANDA_DATA_*` 和 `PANDADATA_*` 两组变量名，优先读取当前进程，其次读取平台保存的凭据。因此登录成功后无需重启原终端即可使用；任何输出中都不得写入凭据。

```powershell
python scripts/build_pit_panel.py `
  --symbols 000001.SZ 600519.SH `
  --start-quarter 2021q1 `
  --end-quarter 2025q4 `
  --as-of-date 20240419 `
  --output outputs/pit_snapshot_20240419.csv

python scripts/validate_pit_panel.py outputs/pit_snapshot_20240419.csv
```

由于已验证的 Panda Data 限制，每次请求最多拆分为 20 个季度。构建器会输出 CSV 及配套的 `.metadata.json` 文件。

## 批量调仓工作流

回测使用包含 `rebalance_date` 或 `date` 列的 CSV，日期格式为 `YYYYMMDD`。构建器只获取一次历史财报版本，然后为每个调仓日输出一个 PIT 分区。

当用户要求按月调仓但未提供调仓表时，先生成每月最后一个交易日：

```powershell
python scripts/generate_rebalance_schedule.py `
  --start-date 20210101 `
  --end-date 20251231 `
  --output outputs/rebalance_month_end_2021_2025.csv
```

```powershell
python scripts/build_pit_panel.py `
  --symbols 000001.SZ 600519.SH `
  --start-quarter 2020q1 `
  --end-quarter 2025q4 `
  --as-of-dates inputs/rebalance_dates.csv `
  --output outputs/pit_rebalance_panel.csv
```

先构建 PIT 长表，再将正式财报的累计字段转换为单季值、TTM 值和基础因子：

```powershell
python scripts/derive_fundamental_factors.py `
  --input outputs/pit_rebalance_panel.csv `
  --output outputs/pit_fundamental_factors.csv
```

在 PIT 审计和因子派生完成后生成面向用户的摘要。最终回答应以此 Markdown 报告为主要产物，原始 CSV 仅作为支撑证据。

```powershell
python scripts/generate_research_summary.py `
  --factors outputs/pit_fundamental_factors.csv `
  --audit outputs/backtest_audit.json `
  --pit-panel outputs/pit_rebalance_panel.csv `
  --schedule outputs/rebalance_month_end_2021_2025.csv `
  --output outputs/research_summary.md
```

派生过程在每个 `(symbol, as_of_date)` 分区内独立运行，不会跨越缺失季度、财年边界或更晚的 PIT 快照做差分。解读因子数值前，阅读 [references/factor-definitions.md](references/factor-definitions.md)。

## 交付标准

每次最终回答都先给出简短、可读的结论，不要以 CSV 路径或原始行数开头。

对“构建”请求，说明：

1. 数据集是否通过 PIT 验证，以及覆盖的历史期间和调仓计划。
2. 最后一个调仓日实际可用的最新财报，让用户看清哪些数据被有意排除。
3. 请求证券的 3 至 6 个相关派生因子摘要，使用易懂语言和人类可读的单位。
4. 重要限制：本 Skill 准备的是研究数据，不构成投资建议。
5. CSV、元数据和审计报告链接，作为支撑材料。

对“审计”请求，先给出 `可信`、`存在风险` 或 `无法确认`，先列出具体违规项，再说明哪些输入尚未提供。

每个最终面板必须包含：

| 字段 | 含义 |
| --- | --- |
| `symbol` | 证券标识符 |
| `quarter` | 财务报告期 |
| `disclosure_date` | 所保留财报版本的披露日 |
| `available_date` | 保守口径下首次可用的交易日 |
| `as_of_date` | 研究截点日期 |
| `vintage_type` | 本版本固定为 `formal_report` |

在保留以上来源链字段的同时输出用户请求的财务字段。不要悄悄用报告期末日期替换这些日期。

## 配套工作流

按以下顺序使用内置脚本：生成调仓表、构建 PIT 快照、派生单季/TTM 因子、审计最终面板和策略代码，最后生成可读摘要。只有在解读派生因子时才阅读 [references/factor-definitions.md](references/factor-definitions.md)。进行长周期研究时，还应配合单独的时点股票池和幸存者偏差工作流。

## 已知限制

- `date` 是披露日期，不是日内时间戳；T+1 是有意采取的保守规则。
- SDK 当前没有文档中提到的 `get_stock_disclosure_date`，不要依赖它。
- 金融与非金融发行人的正式财报字段结构可能不同；缺失字段是数据缺失，不应当作零。
- 如果两个不同的保留版本具有相同的证券、报告期和披露日期，构建器会失败，而不是任意选择一行。继续前应使用版本标识符或时间戳解决源数据歧义。
- PIT 财务面板只消除一种前视偏差，不能解决幸存者偏差、公司行为处理、交易成本或模型过拟合。

扩展数据模型或修改可用性逻辑前，阅读 [references/data-contract.md](references/data-contract.md)。