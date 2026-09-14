# 因子评价反模式

| 反模式 | 为什么错 | 修复 |
|---|---|---|
| 只看 IC，不看 Sharpe / MDD | 经典刷 IC 陷阱（IC 高但回撤吓人） | 必须六联拆解 |
| 把 train+val 合并算 IC | 过拟合，看不到真实泛化 | val 段独立评估 |
| 未做截面标准化就算 Pearson IC | 被尾部主导，结果失真 | 算 IC 前先 winsorize |
| 用 close[T+H] 做 forward return | 实际成交在 open[T+1+H]，未来函数 | 用 `open.shift(-1).pct_change(H).shift(-H)` |
| 忽略涨跌停 / 停牌 | 让回测虚高，实盘买不到 | mask 掉 trade_status==1 / limit_up 触及 |
| 单独看 IC_IR 不看 IC 均值 | IC 全负但稳定也会高 IR | 必须配 IC mean 一起看 |
| 报告只有一个数字 | 无法判断风险来源 | 强制六联视图 |
| Sharpe 远 > IC_IR | 多半 bug：close 当成交价 / 没扣手续费 / T+0 | 见 factor-debug skill |
| 自己写一个"近似" primary_score | 与项目其他因子卡不可比 | 永远调项目内的 `primary_score()` |
| 看了 test 段 IC | 一眼污染 | test 段严格不可见，看了就废 |

## 危险信号清单

如果出现以下情况，**先停下来检查未来函数**，不要相信结果：

- 信号校验通过但 rank IC > 0.15
- 回测年化 > 50%，最大回撤 < 5%
- Sharpe / IC_IR > 1.0
- train / val / test 三段 IC 量级一致且都 > 0.10

真实因子的 val IC 应该比 train IC 低 30~70%。
