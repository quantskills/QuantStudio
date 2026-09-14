# A 股全天候资产配置研究

> 把全天候思路放进 A 股市场，看看五类常见资产在不同经济环境下该怎样搭配。

![CI](https://github.com/quantskills/skill-dalio-all-weather/actions/workflows/ci.yml/badge.svg?branch=main)
![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-3776AB)
![License](https://img.shields.io/badge/License-MIT-green)

## 这个仓库做什么

经典全天候组合主要围绕美国市场设计，直接照搬到 A 股并不合适：长久期国债工具不够丰富，商品也很难用一只产品完整代表。这个仓库从这些现实限制出发，选取股票、长债、中债、黄金和商品五类资产，给出一套可以复查的配置与回测流程。

组合以 30% 股票、40% 长债、15% 中债、7.5% 黄金和 7.5% 商品为起点，再按过去 60 个交易日的波动率调整。程序可以查看当前配置、判断增长—通胀象限，也可以做带成本的季度回测。每次运行都会留下数据来源、决策日、执行日、权重、换手和数据指纹，方便之后核对。

有一点需要先讲清楚：这里用的是带基准偏好的反波动率方法，不是严格的等风险贡献（ERC）优化。项目用于研究和教学，不提供投资建议或实盘指令。

## 可以拿它做什么

- 生成某个日期的五类资产目标配置和风险贡献诊断
- 判断增长、通胀各自处于上行还是下行
- 回看季度调仓、持仓漂移、换手门槛和交易成本
- 比较不同截止日、波动窗口或成本假设
- 保存能够复查的数据与源码指纹

## 基本思路

### 基准配置

| 资产 | 基准权重 | 主要对应环境 |
|---|---:|---|
| 股票 | 30% | 增长上行 |
| 长债 | 40% | 增长下行、通胀下行 |
| 中债 | 15% | 增长下行 |
| 黄金 | 7.5% | 通胀上行 |
| 商品 | 7.5% | 通胀上行 |

每个目标日只使用前一交易日及更早的数据：

```text
raw_i = quadrant_base_i / trailing_volatility_i
target_i = raw_i / sum(raw)
```

系统另用同一 60 日窗口的协方差矩阵计算实际风险贡献：

```text
RC_i = w_i × (Σw)_i / (w'Σw)
```

报告会列出每类资产的风险贡献、最大绝对贡献和 HHI 集中度。如果风险过度集中，程序会给出提醒，但不会把结果包装成“等风险”。

### 宏观象限

| 方向 | PandaData 接口 | 默认指标 | 可用时间近似 |
|---|---|---|---|
| 通胀 | `get_macro_pi` | `PI0000047`，CPI 同比 | 报告期后 15 个自然日 |
| 增长 | `get_macro_na` | `NA0000014`，不变价 GDP 累计同比 | 报告期后 30 个自然日 |
| 利率 | `get_macro_ir` | 用户显式指定单个代码 | 仅作可选诊断 |

象限信号使用 63 个交易日变化、60 日多数平滑和 20 日磁滞。供应商未提供宏观数据的历史发布版本，因此公布滞后只能减少期末前视，不能消除历史修订偏差。

四个象限使用下列偏好权重作为反波动率计算前的基准：

| 象限 | 股票 | 长债 | 中债 | 黄金 | 商品 |
|---|---:|---:|---:|---:|---:|
| 增长上行、通胀上行 | 25% | 20% | 15% | 20% | 20% |
| 增长上行、通胀下行 | 40% | 30% | 15% | 7.5% | 7.5% |
| 增长下行、通胀上行 | 15% | 25% | 20% | 25% | 15% |
| 增长下行、通胀下行 | 20% | 50% | 20% | 5% | 5% |

### 再平衡与记账

- 每个完整季度的最后共同交易日形成目标；
- 残缺的首季度不形成初始目标；
- 最后一个季度只有在查询窗口到达自然季末后才确认；
- 目标在下一共同交易日执行；
- 非执行日权重随资产收益自然漂移；
- 换手按“漂移后的实际权重到新目标”的 L1 距离计算；
- 默认按 `L1 换手 × cost_bps` 扣除一次成本。

默认情况下，季度内的象限变化只记录、不立即调仓。只有显式启用 `--rebalance-on-regime-change` 才增加象限切换调仓。

## 数据接口与替代链

项目使用 PandaData 的 `get_fund_daily`、`get_index_daily`、`get_future_daily`、`get_macro_pi`、`get_macro_na`，并可选使用 `get_macro_ir`。

仓库不附带行情、宏观数据、缓存或 PandaData 安装包。你需要自行取得数据权限，并确认自己的用途符合服务条款。`panda_data==0.0.12` 的公开包信息没有写明许可证和源码地址，详情见[第三方说明](THIRD_PARTY_NOTICES.md)。

| 资产 | 逐日回退顺序 |
|---|---|
| 股票 | `510300.SH / 510500.SH → 000300.SH / 000905.SH` |
| 长债 | `511260.SH → 000012.SH → T_DOMINANT.CFE` |
| 中债 | `511010.SH → 000012.SH → TF_DOMINANT.CFE` |
| 黄金 | `518880.SH → AU_DOMINANT.SHF` |
| 商品 | `501018.SH / 159985.SZ → 000827.SH → CU_DOMINANT.SHF / M_DOMINANT.DCE` |

收益优先按 `log(close/pre_close)` 计算；接口没有 `pre_close` 时才退到 `log(close).diff()`。实际采用的代码、接口和收益口径会写入 `used_symbols.json`。

`000012.SH` 是广义国债指数替代，不代表精确的 10 年或 5 年久期。中国市场的长久期债券工具和商品广度与经典美国全天候组合并不相同。

## 快速开始

目前在 Windows、PowerShell、Python 3.11 和 3.12 下完成了测试。Python 需要 >=3.11 且 <3.13；Linux 和 macOS 暂未做完整验收。

```powershell
git clone https://github.com/quantskills/skill-dalio-all-weather.git
Set-Location skill-dalio-all-weather

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements-lock.txt
```

真实数据只能连接 PandaData 服务方提供的 HTTPS 地址。第三方库自带的是 HTTP 默认地址，程序会直接拒绝，也没有关闭检查的开关。

```text
# 示例地址，请替换为服务方提供的真实地址
PANDADATA_BASE_URL=https://data-provider.example
```

认证可使用短期令牌：

```text
PANDADATA_TOKEN=你的短期令牌
```

也可使用账号密码在 HTTPS 上换取进程内令牌：

```text
PANDADATA_USER=你的账号
PANDADATA_PASSWORD=你的密码
```

配置只从当前进程环境变量或用户目录下的 `~/.pandadata.env` 读取。项目目录里的 `.env` 不会生效，也不要把凭证、缓存或私人研究结果提交到仓库。

运行时会关闭第三方库对 `user.json` 的读写和自动登录，只把令牌留在当前进程中。证书校验始终开启，重定向也会被拒绝。令牌过期后，重新认证并启动命令即可。

第一次使用先跑健康检查。它会检查 Python、SDK、DNS、TLS 证书和凭证是否就绪，但不会打印凭证内容：

```powershell
python scripts\cli.py health-check
python scripts\cli.py check-login

# 服务方排查 HTTPS 时，可暂时只检查运行环境和传输
python scripts\cli.py health-check --transport-only

python scripts\cli.py current-allocation --end 20260710

python scripts\cli.py backtest `
  --start 20180101 --end 20260710 `
  --rebalance Q --vol-window 60 --cost-bps 5 `
  --turnover-threshold 0.05

python scripts\cli.py diagnose-regime `
  --start 20100101 --end 20260710
```

利率诊断必须显式给出单个代码，避免无条件读取整张利率表：

```powershell
python scripts\cli.py diagnose-regime `
  --start 20100101 --end 20260710 `
  --ir-symbol IR_EXPLICIT
```

作为 Skill 使用时，可直接提出：

```text
以 2026-07-10 为截止日，生成 A 股全天候当前配置和风险贡献诊断。
回测 2018-01-01 至 2026-07-10 的季度全天候组合，并说明数据替代和限制。
```

## 数据和复现

- `stock / bond_long / bond_mid / gold / commodity` 五类资产缺一不可
- 每类资产在并集日历上的覆盖率至少要达到 80%
- 通过覆盖率检查后，只保留五类资产都有收益的交易日
- 回测会多读起点前 400 个自然日用于预热，但不把预热期计入绩效
- 每次运行记录配置、实际数据链、依赖版本、数据 SHA-256 和源码 SHA-256
- 同一参数目录里的数据或源码指纹发生变化时，程序拒绝覆盖旧结果

## 输出

当前配置输出：

- `allocation_YYYYMMDD.csv`
- `allocation_YYYYMMDD_metadata.json`

回测目录：

```text
backtest_YYYYMMDD_<run_id>/
├── metrics.json
├── report.md
├── equity.csv
├── equity.png
├── daily_return.csv
├── weights_used.csv
├── turnover.csv
├── decision_dates.csv
├── target_weights.csv
├── executed_rebalances.csv
├── by_quadrant.csv
└── used_symbols.json
```

`decision_dates.csv` 和 `target_weights.csv` 用于独立核验完整季度末的决策、样本内下一共同交易日和目标权重。`run_id` 绑定日期、频率、波动窗口、成本、换手门槛和象限切换开关，避免不同研究配置互相覆盖。

## 已知限制

- 宏观历史修订版本不可得，仍可能存在修订值偏差；
- A 股缺乏与美国市场完全对应的长久期国债 ETF；
- 广义国债指数不能复制精确久期，商品替代也不是完整商品指数；
- `pre_close` 不能替代严格复权、期货展期和可交易价格研究；
- 保证金、展期细节、滑点、税费、容量和停牌未完整模拟；
- 成本采用权重变化的研究近似；
- 历史回测和测试通过都不保证未来收益。
- 真实数据运行依赖 PandaData 数据服务方提供并维护可访问的 HTTPS 地址；只有 HTTP 地址时不会连接。
- 第三方 PandaData 包的许可证和公开维护来源未在其包元数据中说明，使用者需自行确认授权。

## 验证

下面两条命令只做离线检查，不读取个人凭证，也不访问真实数据接口：

```powershell
python -m pytest tests -q
python -m compileall -q scripts tests
```

离线测试可以复查算法和安全失败路径。真实数据是否可用，还取决于服务方 HTTPS 地址和账号权限。

详细定义见 [研究方法](references/methodology.md) 和 [数据映射](references/data-mapping.md)。

## 维护情况

项目目前处于 beta 阶段，离线部分已经可以复现，真实数据仍取决于服务方 HTTPS 地址。问题和改进建议请走 GitHub Issues 或 Pull Requests，初始维护者为 Duzey。

方法思路来自 Ray Dalio 和 Bridgewater 公开介绍的全天候理念。本仓库是独立研究实现，与 Ray Dalio 或 Bridgewater Associates 没有合作或授权关系。

## License

本项目采用 [MIT License](LICENSE)。
