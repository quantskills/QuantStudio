# 数据接口与代码映射

## panda_data 接口

| 用途 | 接口 | 约束 |
|---|---|---|
| 基金/ETF 日线 | `get_fund_daily(symbol, start_date, end_date)` | 单段按服务端上限切分 |
| 指数日线 | `get_index_daily(symbol, start_date, end_date)` | 单段按服务端上限切分 |
| 期货主连日线 | `get_future_daily(symbol, start_date, end_date)` | 必须使用交易所后缀 |
| 物价 | `get_macro_pi(symbol, start_date, end_date)` | 只取明确 symbol |
| 国民经济核算 | `get_macro_na(symbol, start_date, end_date)` | 只取明确 symbol |
| 利率/汇率诊断 | `get_macro_ir(symbol, start_date, end_date)` | symbol 必填，禁止全库查询 |

宏观 PI/NA 的已验证字段为 `symbol / period_date / data_value`：

- CPI 同比：`PI0000047`
- 不变价 GDP 累计同比：`NA0000014`

IR 不参与增长 × 通胀象限，只在用户显式传入 `--ir-symbol` 时查询并单独输出。

## 五类资产

### stock

| 层级 | 代码 | 说明 |
|---|---|---|
| ETF | `510300.SH`, `510500.SH` | 沪深 300 / 中证 500 |
| 指数 | `000300.SH`, `000905.SH` | ETF 上市前回退 |

### bond_long

| 层级 | 代码 | 说明 |
|---|---|---|
| ETF | `511260.SH` | 10 年国债 ETF 候选 |
| 指数 | `000012.SH` | 上证国债指数，仅作广义国债替代 |
| 期货 | `T_DOMINANT.CFE` | 10 年国债期货主连 |

### bond_mid

| 层级 | 代码 | 说明 |
|---|---|---|
| ETF | `511010.SH` | 国债 ETF 候选 |
| 指数 | `000012.SH` | 上证国债指数，仅作广义国债替代 |
| 期货 | `TF_DOMINANT.CFE` | 5 年国债期货主连 |

`000012.SH` 不能被描述为精确 10 年或 5 年久期。ETF 和期货候选才提供更明确的久期区分。

### gold

| 层级 | 代码 | 说明 |
|---|---|---|
| ETF | `518880.SH` | 黄金 ETF |
| 期货 | `AU_DOMINANT.SHF` | 黄金期货主连 |

### commodity

| 层级 | 代码 | 说明 |
|---|---|---|
| 基金 | `501018.SH`, `159985.SZ` | 能源、农产品代表 |
| 指数 | `000827.SH` | 商品期货综合指数候选 |
| 期货 | `CU_DOMINANT.SHF`, `M_DOMINANT.DCE` | 工业金属、农产品兜底 |

## 收益和回退记录

每个候选先提取收盘字段。若同时存在 `pre_close`，使用：

```text
log(close / pre_close)
```

若没有 `pre_close`，才使用：

```text
log(close).diff()
```

系统按候选顺序逐日补缺，并在实际链上标注 `[close/pre_close]` 或 `[close_diff]`。这条链写入当前配置表、`metrics.json` 和 `used_symbols.json`。

## 覆盖率

必须存在以下五列：

```text
stock, bond_long, bond_mid, gold, commodity
```

每列在并集日历上的非空比例必须至少为 80%。通过后再取五类共同非空日期。失败会列出缺失资产或低覆盖资产，不会把核心资产缺失静默填零。

## 缓存和错误

接口按服务端时间跨度切分并以函数名、symbol 和日期生成缓存键。第三方调用失败时，日志只记录异常类型，不回显完整异常文本，以避免泄露请求细节或凭证。

## 连接安全

真实数据连接必须通过用户显式配置、由 PandaData 数据服务方提供并维护的受信 HTTPS 地址。HTTP、URL 内嵌凭证、查询参数、片段和所有重定向都会被拒绝，数据客户端强制校验证书与主机名。命令先完成启动健康检查和登录，只使用进程内令牌，并在整个进程内阻止第三方 SDK 读取、写入、自动刷新或删除 `user.json`。令牌到期后需要结束进程并重新认证。

锁定的 `panda_data==0.0.12` 默认服务地址使用 HTTP，因此不能直接作为本项目的真实数据地址。仓库不分发该第三方安装包；使用者需自行确认服务访问权、数据授权和包的使用许可。
