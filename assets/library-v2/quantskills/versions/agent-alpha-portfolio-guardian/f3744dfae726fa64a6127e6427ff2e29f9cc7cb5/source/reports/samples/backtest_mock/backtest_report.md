# 守卫信号有效性回测报告

## 样本与规则

- 样本区间: `2024-01-01` → `2025-12-31`
- 再平衡间隔: `20` 日
- 后验窗口 horizon: `20` 日
- rules_version: `guardian-rules-v0.1`
- data_version: `guardian-bt-mock-v0.1+guardian-rules-v0.1`
- source_mode: `mock`
- n_signal_rows: `81`

## 分桶表现

```
           signal  n  mean_fwd_ic  mean_fwd_ret  std_fwd_ret  mean_rank_ic_at_signal
         deweight  2    -0.011500     -0.005750     0.001018                0.012950
             keep 47     0.026668      0.013334     0.007361                0.029219
rebuild_candidate  5    -0.012818     -0.006408     0.003972                0.004986
 retire_candidate 16    -0.011144     -0.005571     0.003095                0.004735
            watch 11     0.005447      0.002722     0.007805                0.017905
```

## 描述性准确率

- keep 组 mean fwd_ic: `0.02666808510638298`
- avoid 组 mean fwd_ic: `-0.011538695652173914`
- keep − avoid fwd_ic: `0.038206780758556894`
- avoid 弱于 keep 占比: `1.0`
- retire 后 fwd_ic<0 占比: `1.0`

定义:

- `avoid_weaker_than_keep_rate`: signal∈{retire_candidate,deweight,rebuild_candidate} 且后续 fwd_ic < keep 组均值 的占比
- `retire_negative_fwd_ic_rate`: retire_candidate 信号后 fwd_ic < 0 的占比

## keep 组合代理路径风险

- max_drawdown: `0.0`
- cum_return: `0.4565709615844731`
- n_dates: `27`

## 滚动窗样本外

```
 fold      start        end  n  keep_mean_fwd_ic  avoid_mean_fwd_ic  avoid_weaker_than_keep_rate  retire_negative_fwd_ic_rate
    1 2024-01-01 2024-08-12 27          0.022016          -0.012175                          1.0                          1.0
    2 2024-09-09 2025-04-21 27          0.026311          -0.012763                          1.0                          1.0
    3 2025-05-19 2025-12-29 27          0.032011          -0.010157                          1.0                          1.0
```

## 免责声明

本回测仅检验守卫规则的历史统计特征，不构成投资建议。
