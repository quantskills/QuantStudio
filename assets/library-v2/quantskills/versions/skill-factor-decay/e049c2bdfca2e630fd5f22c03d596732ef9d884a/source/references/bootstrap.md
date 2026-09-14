# Bootstrap 半衰期置信区间

## 方法

IC(h) 是逐日截面 IC 的均值。半衰期的估计受 IC 序列的日间波动影响，需要 Bootstrap 给出置信区间。

## 算法

```python
import numpy as np

def bootstrap_half_life(ic_series: dict,  # {horizon: np.array of daily IC}
                        n_bootstrap: int = 1000,
                        alpha: float = 0.05) -> dict:
    """
    ic_series: {1: [daily ICs], 3: [...], 5: [...], ...}
    返回: {tau, ci_lower, ci_upper, tau_samples}
    """
    horizons = np.array(sorted(ic_series.keys()))
    n_dates = len(list(ic_series.values())[0])
    
    tau_samples = []
    for _ in range(n_bootstrap):
        # 对每天 bootstrap（保持日间相关性）
        idx = np.random.choice(n_dates, size=n_dates, replace=True)
        ic_means = np.array([
            np.mean(ic_series[h][idx]) for h in horizons
        ])
        
        # 拟合指数衰减
        if np.abs(ic_means[0]) > 1e-8:
            # log-linear fit
            valid = ic_means[0] * ic_means > 0  # sign consistency
            if valid.sum() >= 2:
                log_ic = np.log(np.abs(ic_means[valid]))
                slope, _ = np.polyfit(horizons[valid], log_ic, 1)
                tau = -1.0 / slope if slope < 0 else np.inf
            else:
                tau = np.inf
        else:
            tau = np.inf
        
        tau_samples.append(tau)
    
    tau_samples = np.array(tau_samples)
    finite_taus = tau_samples[np.isfinite(tau_samples)]
    
    if len(finite_taus) < 100:
        return {
            'tau': np.inf,
            'ci_lower': np.inf,
            'ci_upper': np.inf,
            'warning': '半衰期过长或IC不衰减，无法估计'
        }
    
    half_life = np.log(2) * np.median(finite_taus)
    ci_lower = np.log(2) * np.percentile(finite_taus, 100 * alpha / 2)
    ci_upper = np.log(2) * np.percentile(finite_taus, 100 * (1 - alpha / 2))
    
    return {
        'tau': half_life,
        'ci_lower': ci_lower,
        'ci_upper': ci_upper,
        'n_valid_bootstrap': len(finite_taus)
    }
```

## 注意事项

1. **Block bootstrap**：如果怀疑 IC 序列有自相关（连续几天 IC 方向一致），用 block bootstrap（block size = 5~10）替代独立重采样
2. **异常值处理**：Bootstrap 前剔除 IC 绝对值 > 0.5 的极端日期（通常是数据错误）
3. **样本量要求**：至少 60 个交易日的 IC 序列才做 Bootstrap，否则直接用非参数法
4. **符号处理**：IC 为负时取绝对值拟合衰减率，但报告保留原始符号
