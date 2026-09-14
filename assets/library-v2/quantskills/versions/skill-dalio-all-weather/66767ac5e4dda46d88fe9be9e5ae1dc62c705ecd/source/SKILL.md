---
name: dalio-all-weather
description: "Build and audit reproducible, research-only A-share All Weather allocations with PandaData, growth-inflation regimes, inverse-volatility risk budgets, quarterly backtests, and risk-contribution diagnostics. Use for current allocations, regime analysis, allocation backtests, or methodology reviews."
---

# A 股全天候资产配置研究

研究股票、长债、中债、黄金和商品五类资产的配置。把所有结果标记为 `RESEARCH_ONLY`，不要把目标权重、回测或象限判断写成投资建议和交易指令。

## 运行准备

使用 Python >=3.11 且 <3.13，并在 Skill 根目录安装锁定依赖：

```powershell
python -m pip install --require-hashes -r requirements-lock.txt
```

真实数据只连接 PandaData 服务方提供的 HTTPS 地址：

```text
# 示例地址，运行前替换
PANDADATA_BASE_URL=https://data-provider.example
```

优先使用短期令牌：

```text
PANDADATA_TOKEN=你的短期令牌
```

或在 HTTPS 上使用账号密码换取进程内令牌：

```text
PANDADATA_USER=你的账号
PANDADATA_PASSWORD=你的密码
```

只从当前进程环境变量或用户目录下的 `~/.pandadata.env` 读取配置，不读取项目目录或当前工作目录中的 `.env`。不要在回复、日志、报告或仓库中展示凭证、令牌、完整第三方异常、私有缓存和私人研究结果。

保持 SDK 的 `user.json` 读写和自动登录关闭，始终校验证书，只向数据客户端传入进程内令牌。HTTP、重定向和证书错误都直接停止；令牌过期后重新认证，不从磁盘自动刷新。

先执行启动健康检查，再验证登录：

```powershell
python scripts\cli.py health-check
python scripts\cli.py check-login
```

## 标准流程

1. 明确研究起止日、再平衡频率、60 日波动窗口、交易成本和换手门槛。
2. 通过 `get_fund_daily`、`get_index_daily`、`get_future_daily` 获取五类资产，通过 `get_macro_pi` 和 `get_macro_na` 获取宏观数据。
3. 检查五类资产覆盖率；任一缺失或覆盖率低于 80% 时停止。
4. 使用 63 日变化、60 日多数平滑和 20 日磁滞形成增长—通胀象限。
5. 在完整季度末形成目标，并在下一共同交易日执行。
6. 输出配置、实际持仓、风险贡献、换手、成本、指纹和限制说明。

仓库不附带行情、宏观数据、缓存或 PandaData 安装包。运行者自行取得数据权限，服务方负责提供 HTTPS 地址。`panda_data==0.0.12` 的公开包信息没有写明许可证和源码地址，使用前确认授权；细节见 `THIRD_PARTY_NOTICES.md`。

常用命令：

```powershell
python scripts\cli.py current-allocation --end 20260710

python scripts\cli.py backtest `
  --start 20180101 --end 20260710 `
  --rebalance Q --vol-window 60 --cost-bps 5 `
  --turnover-threshold 0.05

python scripts\cli.py diagnose-regime `
  --start 20100101 --end 20260710
```

`get_macro_ir` 只用于可选诊断，且必须显式给出单个 `--ir-symbol`。

## 研究约定

- 五类基准权重固定为股票 30%、长债 40%、中债 15%、黄金 7.5%、商品 7.5%。
- 目标权重为 `normalize(象限基准权重 / 前 60 日波动率)`。称为反波动率风险预算，不得称为严格 ERC。
- 用 60 日协方差矩阵另行报告实际风险贡献、最大绝对贡献和 HHI 集中度。
- CPI 使用 `PI0000047`，按报告期后 15 个自然日近似可用；GDP 使用 `NA0000014`，按报告期后 30 个自然日近似可用。
- 四象限偏好权重依次为：增长上/通胀上 `25/20/15/20/20`，增长上/通胀下 `40/30/15/7.5/7.5`，增长下/通胀上 `15/25/20/25/15`，增长下/通胀下 `20/50/20/5/5`；顺序均为股票、长债、中债、黄金、商品。
- 宏观历史发布版本不可得。即使加入公布滞后，也必须披露修订值偏差。
- 残缺的首季度不形成初始目标；最后一个季度只有在查询窗口到达自然季末后才视为完整季度。
- 决策在下一共同交易日执行；样本末日没有下一日时只记录决策，不伪造执行日。
- 默认不因季度内象限变化立即调仓。只有用户明确要求时才使用 `--rebalance-on-regime-change`。
- 非执行日持仓随收益自然漂移。换手和成本必须从漂移后的真实权重计算。
- 回测向请求起点前扩 400 个自然日用于预热，绩效从请求起点后的首个共同交易日开始。
- 相同参数目录的数据或源码指纹不一致时必须拒绝覆盖。

## 数据替代

- 股票：`510300.SH / 510500.SH → 000300.SH / 000905.SH`
- 长债：`511260.SH → 000012.SH → T_DOMINANT.CFE`
- 中债：`511010.SH → 000012.SH → TF_DOMINANT.CFE`
- 黄金：`518880.SH → AU_DOMINANT.SHF`
- 商品：`501018.SH / 159985.SZ → 000827.SH → CU_DOMINANT.SHF / M_DOMINANT.DCE`

优先按 `log(close/pre_close)` 计算收益；没有 `pre_close` 时才使用 `log(close).diff()`。将实际替代链和收益口径写入 `used_symbols.json`。`000012.SH` 只是广义国债替代，不得解释为精确的 10 年或 5 年久期。

## 输出约定

当前配置至少输出：

- `allocation_YYYYMMDD.csv`
- `allocation_YYYYMMDD_metadata.json`

回测使用 `backtest_YYYYMMDD_<run_id>/`，至少输出：

- `metrics.json` 与 `report.md`
- `equity.csv`、`daily_return.csv`、`weights_used.csv`
- `turnover.csv` 与 `executed_rebalances.csv`
- `decision_dates.csv` 与 `target_weights.csv`
- `by_quadrant.csv` 与 `used_symbols.json`

`decision_dates.csv` 和 `target_weights.csv` 必须能够独立核验完整季度末决策、样本内下一共同交易日和目标权重。报告同时保留请求日期、预热期、实际评估期、数据覆盖率、参数、数据 SHA-256、源码 SHA-256、依赖版本和已知限制。

## 必须披露的限制

明确说明宏观修订值偏差、长久期债券替代不足、商品广度不足、复权与期货展期近似，以及保证金、滑点、税费、容量和停牌未完整模拟。历史结果和测试通过都不保证未来收益。

## 验证

```powershell
python -m pytest tests -q
python -m compileall -q scripts tests
```

测试通过只说明程序行为符合研究约定，不说明策略有效或适合实盘。没有服务方 HTTPS 地址时停止真实数据命令。统计和数据定义见 `references/methodology.md` 与 `references/data-mapping.md`。
