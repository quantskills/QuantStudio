# 回测反模式

| 反模式 | 后果 | 修复 |
|---|---|---|
| **未来函数**：用 T 日 close 做 T 日成交价 | Sharpe 飙到天上去 | 严格 T+1 开盘 |
| **生存者偏差**：universe 只用现在还活着的股票 | 回测好看实盘崩 | 用动态成分池（每日的 universe 不同） |
| **T+0 成交**：A 股不能 T+0 卖出当日买入 | 高频信号假装中频 | 强制 T+1 |
| **零手续费** | 刷 Sharpe 最快方法 | 双边 15bp 起步（A 股） |
| **忽略涨跌停** | 让回测多收益但实盘买不到 | mask 涨停 / 跌停 / 停牌 |
| **不算换手** | 高频信号假装是低频策略 | 每日算 turnover，年化 |
| **不画回撤图** | 看不到中间最大回撤 | 强制四联图 |
| **没有 benchmark** | 3% 超额可能只是 beta=1.05 | 至少配一个 benchmark |
| **回测段=训练段** | 过拟合伪装成"成功" | 严格三段切分 |
| **改测试段后回看** | 测试段被污染 | test 段严格不可见 |

## 危险信号清单

跑完回测出现以下任一情况，**先停下检查 bug**：

- 年化 > 50% 且 MDD < 5%
- Sharpe > 5
- 换手 < 5%（中频信号不可能这么低）
- 全仓时间 < 50%
- 持仓股数 = 1 或 = universe 大小

## 正确 vs 错误时序对照

```python
# ❌ 错误 1：用 T 日 close 算 T 日成交
factor[t] = close[t] / close[t - 5] - 1   # 因子计算 OK
# 但成交时：
trade_at_t_close = signal[t]              # ❌ T 日收盘怎么会知道 T 日收盘后的信号？

# ✅ 正确
trade_at_t_plus_1_open = signal[t]        # T+1 开盘用 T 日的信号成交

# ❌ 错误 2：forward return 方向反了
fwd_ret = close.pct_change(h)             # ❌ backward

# ✅ 正确
fwd_ret = close.pct_change(h).shift(-h)   # shift -h 让 t 行存 [t, t+h] 的收益
fwd_ret = open.shift(-1).pct_change(h).shift(-h)  # 更准：开盘成交价

# ❌ 错误 3：fillna(method='bfill') 用未来值填过去
factor = factor.fillna(method="bfill")    # ❌ 未来填过去 = 未来函数

# ✅ 正确
factor = factor.fillna(method="ffill")    # 历史填未来（注意信息饱和问题）
```
