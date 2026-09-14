# A 股 PIT 财务数据审计器

[English](README.en.md)

为历史调仓构建并审计 A 股财务因子输入。本 Skill 只回答一个关键问题：**某个历史调仓日使用的财报，是否当时已经披露并可被保守地交易使用？**

它不是通用因子回测引擎、选股器或投资建议工具。它输出时点数据（PIT）财务面板、基础财务因子，以及可供独立回测引擎使用的审计证据链。

## 核心特色

多数回测工具默认接收一张“已经准备好的因子表”，却无法回答这张表在历史上是否偷看了后来披露或修订的财报。本 Skill 的特别之处，是把财报版本的时间线变成可验证的数据血缘：

1. **还原历史可见财报，而非使用今天的最新版。** 对每个 `(证券, 财报期, 调仓日)` 保留当时已披露的最后一个版本，避免将后续修订值带回历史。
2. **采用明确且保守的 T+1 可用性规则。** 不假定披露当日盘中即可交易，统一从披露后的首个交易日开始使用，规则可复现、可审计。
3. **把因子值和证据链一起交付。** 每行同时记录 `quarter`、`disclosure_date`、`available_date`、`as_of_date` 与 `vintage_type`，研究者可以追溯一个因子值为何在该日可用。
4. **既能构建，也能审计。** 除了生成 PIT 面板和单季/TTM 因子，还会检查已有面板、调仓日和 Python 代码中的 `is_latest=True`、负数 `shift`、缺失快照等常见风险。
5. **对版本歧义采取失败优先。** 若同一证券、财报期和披露日存在无法区分的不同版本，不会任意挑选一条数据，而是中止并要求补充版本标识。

它与通用因子回测工具形成前后衔接：本 Skill 负责保证输入数据在时间上可信，回测引擎再负责 IC、分组收益、净值、换手和交易成本等绩效评估。

## 项目状态与维护

- 状态：QuantSkills Community Project，不是 QuantSkills 官方、认证、验证、背书或生产可用项目。
- 维护者：仓库贡献者。发布后，请通过仓库 Issue 反馈可复现缺陷、数据契约变化和方法论问题。
- 目标仓库标识：`quantskills/skill-a-share-pit-fundamental-vintage-builder`。机器可读元数据见 [skill.yml](skill.yml)。

## 运行时入口

- Codex 与 Claude Code：读取根目录 [SKILL.md](SKILL.md)。
- Cursor：读取 [agents/cursor-rule.mdc](agents/cursor-rule.mdc)。
- Hermes 与 OpenClaw：读取 [agents/portable-loader.md](agents/portable-loader.md)。
- OpenClaw 兼容的界面元数据：见 [agents/openai.yaml](agents/openai.yaml)。

各入口均以 `SKILL.md` 为唯一工作流来源，尤其要求在首次实时 Panda Data 请求前走安全登录流程，并保持 PIT 数据血缘字段。
## 支持场景

1. 为指定 A 股证券构建按月或自定义调仓日的 PIT 财务面板。
2. 将 PIT 面板转换为单季、TTM，以及基础质量、盈利、成长和杠杆因子。
3. 审计用户提供的财务面板、调仓日与 Python 因子或回测代码，识别常见的财报前视偏差。
4. 生成简洁的研究摘要，记录每个历史时点实际可获得的最新财报。

## 数据来源、假设与参数

- 数据来源：用户已授权的 `panda_data` Python SDK 账户。本仓库不包含 Panda Data 数据集、凭据、API Key 或私有研究数据；用户须遵守 Panda Data 的适用条款与数据权限要求。
- PIT 规则：通过 `get_fina_reports(is_latest=False)` 取得保留的财报版本；财报在披露日后的首个交易日才视为可用，即保守的 T+1 规则。
- 关键参数：证券代码、财报季度范围、调仓日或调仓频率、所需财务字段，以及 T+1 可用性规则。
- 详细接口与数据血缘契约见 [references/data-contract.md](references/data-contract.md)；因子定义见 [references/factor-definitions.md](references/factor-definitions.md)；研究边界见 [references/research-boundaries.md](references/research-boundaries.md)。

## 使用方式

阅读 [SKILL.md](SKILL.md) 获取完整的 Agent 工作流和命令。首次发生实时数据请求时，Skill 会先让用户选择“构建 PIT 数据”或“审计现有回测”。凭据只在带掩码的系统原生登录终端中输入，不会要求用户在对话中提供，也不会写入输出文件或仓库。

## 文件结构

```text
SKILL.md                              Agent 工作流与交付要求
README.md                             中文项目说明
README.en.md                          English project documentation
LICENSE                               GNU GPLv3 许可证原文
skill.yml                             QuantSkills 项目元数据
agents/                               Cursor、Hermes 与 OpenClaw 运行时入口
scripts/build_pit_panel.py            Panda Data PIT 面板构建器
scripts/audit_backtest_input.py       面板、调仓日与 Python 代码审计器
scripts/derive_fundamental_factors.py 单季、TTM 与基础因子派生器
scripts/generate_rebalance_schedule.py 月末交易日调仓表生成器
scripts/generate_research_summary.py  可读研究摘要生成器
references/data-contract.md           API 与数据血缘契约
references/factor-definitions.md      因子公式与字段要求
references/research-boundaries.md     数据、假设、局限与风险边界
tests/                                确定性回归测试
evals/evals.json                      代表性用户请求
```

## 局限与风险边界

本 Skill 仅缓解一种前视偏差：财报可用性和修订版本造成的时间泄漏。它不解决幸存者偏差、公司行为、退市收益、成交价格假设、交易成本、流动性、税费、数据供应商错误或模型过拟合。静态代码审计只能提供证据，不能证明整个策略绝对不存在泄漏。

仅供研究和教育使用，不构成投资建议、交易指令、适当性评估或收益保证。
