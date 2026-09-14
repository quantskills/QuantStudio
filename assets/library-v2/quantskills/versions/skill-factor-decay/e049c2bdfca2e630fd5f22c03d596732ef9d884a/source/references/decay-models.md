# 衰减模型 (Decay Models)

> IC(h) 随持有期 h 的衰减可以用不同模型刻画。选模型优先看图，再拟合。

## 模型一览

### 1. 指数衰减 (Exponential Decay)

```
IC(h) = IC₀ · exp(−h / τ)
```

- **适用**：标准动量、反转、短期情绪因子
- **参数**：IC₀ 初始 IC，τ 衰减常数
- **半衰期**：τ₀.₅ = τ · ln(2)
- **拟合**：log(IC(h)) ~ h 线性回归

### 2. 双指数衰减 (Bi-Exponential)

```
IC(h) = IC₁ · exp(−h / τ₁) + IC₂ · exp(−h / τ₂)
```

- **适用**：混合信号（短期情绪 + 中期基本面）
- **参数**：IC₁ 快速分量，IC₂ 慢速分量
- **半衰期**：数值解 IC(τ₀.₅) = IC(1d) / 2
- **拟合**：非线性最小二乘

### 3. 幂律衰减 (Power Law)

```
IC(h) = IC₀ · h^(−α)
```

- **适用**：长记忆因子（价值、质量、低波）
- **参数**：α 衰减指数
- **半衰期**：τ₀.₅ = 2^(1/α)
- **拟合**：log(IC(h)) ~ log(h) 线性回归

### 4. 非参数 (Non-Parametric)

各持有期的样本 IC 均值直接使用，不拟合参数模型。适合样本少或曲线不规则的情况。

## 模型选择流程

```
1. 计算 h ∈ {1,2,3,5,10,15,20} 的 IC(h) 样本均值
2. 画出 IC(h) vs h 散点图
3. 肉眼判断形状：
   - 指数下降 → 试指数模型
   - 快速跌落 + 平台 → 试双指数
   - 长尾衰减 → 试幂律
   - 不规则 → 用非参数
4. 拟合后看 R²
5. 若 R² < 0.5，降级为非参数
```

## 拟合代码示例

```python
import numpy as np
from scipy.optimize import curve_fit

def fit_exponential(horizons, ic_means):
    """指数衰减拟合"""
    def model(h, ic0, tau):
        return ic0 * np.exp(-h / tau)
    
    popt, pcov = curve_fit(model, horizons, ic_means, 
                           p0=[ic_means[0], 10], 
                           bounds=([-1, 1], [1, 100]))
    ic0, tau = popt
    half_life = tau * np.log(2)
    return ic0, tau, half_life, np.sqrt(np.diag(pcov))

def fit_power_law(horizons, ic_means):
    """幂律衰减拟合"""
    # log-log 线性回归
    valid = (horizons > 0) & (np.abs(ic_means) > 1e-10)
    log_h = np.log(horizons[valid])
    log_ic = np.log(np.abs(ic_means[valid]))
    slope, intercept = np.polyfit(log_h, log_ic, 1)
    alpha = -slope
    ic0 = np.exp(intercept) * np.sign(ic_means[0])
    half_life = 2 ** (1 / alpha) if alpha > 0 else np.inf
    return ic0, alpha, half_life
```
