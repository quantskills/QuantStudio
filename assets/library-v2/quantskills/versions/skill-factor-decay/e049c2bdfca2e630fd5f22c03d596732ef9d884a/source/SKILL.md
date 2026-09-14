---
name: factor-decay
description: Use when an agent needs to analyze how a factor signal's predictive power
  decays over holding horizons — compute IC decay curves, half-life, turnover decay,
  and group-return decay to determine optimal rebalancing frequency and signal shelf
  life.
quantSkills:
  project_type: skill
  category: factor
  tags:
  - factor-decay
  - ic-half-life
  - signal-shelf-life
  - turnover-decay
  - horizon-analysis
  - bootstrap-ci
  - exponential-decay
  - sign-reversal
  - rank-ic-decay
  - pandadata
  platforms:
  - claude-code
  - codex
  - openclaw
  - cursor
  status: stable
  validation_level: production
  maintainer_type: community
  summary_zh: 因子衰减分析：多期限 Rank IC 衰减曲线 → 指数/幂律/双指数拟合 → Bootstrap 半衰期置信区间 → 换手衰减 + Q5-Q1 分组收益衰减 → 推荐最优再平衡频率。已对接 Pandadata 计算 1d/3d/5d/10d/20d 五期限 forward returns。
  summary_en: Factor decay analysis with multi-horizon Rank IC curves, exponential/power-law/bi-exponential fitting, bootstrap half-life CIs, turnover decay, and Q5-Q1 group-return decay. Recommends optimal rebalancing frequency. Integrated with Pandadata for 5-horizon forward returns.
  license: GPL-3.0
  repository: https://github.com/quantskills/skill-factor-decay
---

```json qsh-form
{
  "version": 1,
  "task": {
    "placeholder": "补充因子信号文件、样本区间、训练/验证/测试划分或衰减诊断要求"
  },
  "fields": [
    {
      "key": "factor",
      "label": "内置因子",
      "type": "select",
      "default": "momentum_20",
      "help": "填写自定义表达式时以表达式为准",
      "options": [
        { "value": "momentum_20", "label": "动量（20日）" },
        { "value": "reversal_5", "label": "反转（5日）" },
        { "value": "lowvol_20", "label": "低波动（20日）" },
        { "value": "alpha101_101", "label": "Alpha101 #101" },
        { "value": "alpha101_12", "label": "Alpha101 #12" },
        { "value": "corr_open_vol", "label": "量价背离" }
      ]
    },
    {
      "key": "expr",
      "label": "自定义因子表达式",
      "type": "textarea",
      "placeholder": "如：-1 * correlation(rank(open), rank(volume), 10)"
    },
    {
      "key": "universe",
      "label": "股票池",
      "type": "select",
      "default": "000300.SH",
      "options": [
        { "value": "000300.SH", "label": "沪深300" },
        { "value": "000905.SH", "label": "中证500" },
        { "value": "399006.SZ", "label": "创业板指" },
        { "value": "000852.SH", "label": "中证1000" }
      ]
    },
    {
      "key": "horizon",
      "label": "衰减期限组",
      "type": "select",
      "default": "1,3,5,10,20",
      "options": [
        { "value": "1,3,5,10,20", "label": "标准：1/3/5/10/20日" },
        { "value": "1,2,3,5,10", "label": "短周期：1/2/3/5/10日" },
        { "value": "5,10,20,40,60", "label": "中长周期：5/10/20/40/60日" }
      ]
    }
  ],
  "prompt_template": "{{#task}}任务与材料：\n{{task}}\n\n{{/task}}{{#attachments}}用户上传的材料（已放入工作区）：\n{{attachments}}\n\n{{/attachments}}请分析内置因子 {{factor}}{{#expr}}（以自定义表达式 {{expr}} 为准）{{/expr}} 在股票池 {{universe}}、预测期限 {{horizon}} 日的信号衰减。计算逐日截面 Rank IC 曲线、衰减模型与 Bootstrap 半衰期置信区间，并联动检查换手和 Q5-Q1 收益衰减、符号反转及训练测试隔离，给出信号保质期与再平衡频率建议，输出中文报告。"
}
```

# 因子衰减分析 (Factor Decay Analysis)

> 给定一个截面因子信号 `[date × symbol × factor_value]` 和多期限 forward returns，分析其预测能力随持有期的衰减特征，回答：**这个因子能用多久、多久该换一次**。

## 管线定位

```
因子挖掘 → 因子评估 → 正交化 → 衰减分析 → 因子合并 → 回测
                              ▲ 本 skill
                              你在这里
```

衰减分析是正交化（`factor-orthogonalize`）之后、多因子合并（`factor-blend`）之前的**质量把控节点**：
- 衰减过快的因子（半衰期 < 2 天）不适合低频合并
- 衰减曲线一致的因子在等权合并时更稳定
- 半衰期决定最优再平衡频率

## 核心规则

1. **逐日截面评价**：每一天对信号做一次截面 IC 计算，不是时间序列 IC。
2. **多期限对比**：至少覆盖 1d / 3d / 5d / 10d / 20d 五个期限。
3. **train/val/test 严格隔离**：衰减曲线只在 train+val 上拟合，test 用于验证。
4. **半衰期有置信区间**：不能只报一个点估计，需要 Bootstrap 置信区间。
5. **衰减 ≠ 失效**：IC 衰减到零才是失效；衰减到某个平台值可能仍然可用。
6. **换手与衰减联动分析**：IC 衰减快 + 换手高的因子是伪 Alpha 的典型特征。

## 工作流（标准 7 步）

```
1. 校验输入：signal [date × symbol]、forward returns [date × symbol × horizon]
2. 计算各期限 Rank IC 序列
3. 拟合 IC 衰减曲线（指数衰减 / 幂律 / 双指数）
4. 估计 IC 半衰期 τ₀.₅（Bootstrap 置信区间）
5. 计算换手率衰减（逐日 turnover 随重平衡间隔的变化）
6. 计算分组收益衰减（Q5−Q1 spread 随持有期的变化）
7. 输出标准化 DecayReport
```

## 核心指标定义

| 指标 | 定义 | 判据 |
|---|---|---|
| **IC(h)** | 持有期 h 的 Rank IC 均值 | 绝对值越高越好 |
| **τ₀.₅** | IC(h) 衰减到 IC(1d) 一半的持有天数 | > 5 天可用，< 2 天危险 |
| **TO 衰减率** | 每日 turnover 随重平衡间隔的降速 | 降得快说明信号稳定 |
| **Spread 衰减** | Q5−Q1 收益差随持有期的变化 | 单调递减是健康的 |
| **平台值 IC∞** | IC 衰减曲线的渐近值 | 显著 > 0 说明有长期 Alpha |

## 衰减模型选择

| 场景 | 推荐模型 |
|---|---|
| 标准动量/反转因子 | 指数衰减：IC(h) = IC₀ · exp(−h/τ) |
| 多时间尺度混合 | 双指数：IC(h) = IC₁·exp(−h/τ₁) + IC₂·exp(−h/τ₂) |
| 长记忆因子（价值/质量） | 幂律：IC(h) = IC₀ · h^(−α) |
| 样本短、噪声大 | 非参数：直接用各期限样本 IC 均值，不拟合 |

默认推荐：**先画非参数 IC(h) 曲线观察形状，再选模型拟合**。

### ⚠️ 方向反转（Sign Reversal）

A 股市场中常见**IC 方向反转**：短期 IC 为负（均值回复），中长期 IC 为正（动量延续）。这不是"IC 不单调"的 bug，而是真实的因子结构。

| 信号模式 | IC(h) 形态 | 处理方式 |
|---|---|---|
| 单边衰减 | 单调递减（绝对值） | 标准指数/幂律拟合 |
| 方向反转 | 负 → 零 → 正（或反之） | 不建议强制拟合参数模型，用非参数 + 分别标注各 horizon 的 IC 符号和显著性 |
| 纯噪声 | 全 horizon IC ≈ 0 | 标记为不可用 |

判别方法：若 `|IC(1d)|` 和 `|IC(20d)|` 的符号相反且各自显著（\|IC\| > 0.005），则为方向反转，应降级为非参数报告。

## 项目实现

- **`scripts/decay_analysis.py`**：独立可运行的衰减分析脚本
  ```bash
  # 默认路径（分析原始因子）
  python scripts/decay_analysis.py

  # 分析正交化后因子
  python scripts/decay_analysis.py --factor-dir data/factors_orthogonalized

  # 仅分析等权合成因子
  python scripts/decay_analysis.py --composite-only
  ```
  输入：`data/factors/F*.parquet`（或正交化后）
  输出：
  - `data/decay_reports/decay_report_*.json` — 结构化 DecayReport
  - 控制台文本报告（IC 曲线 + 半衰期 CI + 推荐频率）
  - 自动判定质量等级 + 推荐再平衡频率

**等权合成**：脚本内置 `make_equal_weight_composite()` 将所有输入因子等权合成为一个复合因子，可一并分析合成因子的衰减特征。

## 管线连接

```
Pandadata(get_stock_daily) → forward_ret_1d/3d/5d/10d/20d
data/factors/F*.parquet (or factors_orthogonalized/) → 因子信号
                                    ↓
                           decay_analysis.py
                    逐日 Rank IC → 衰减拟合 → Bootstrap
                                    ↓
                    data/decay_reports/decay_report_*.json
                                    ↓
                    推荐再平衡频率 + 质量判定
                                    ↓
                          skill-factor-blend（因子合并）

## 接口映射

| 本 skill 概念 | 你的项目对应 |
|---|---|
| 输入信号 | `signal[date × symbol]` 截面 z-score |
| 多期限 forward returns | `forward_ret_1d`, `forward_ret_5d`, ..., `forward_ret_20d` |
| IC 衰减曲线 | `{horizon: IC_mean}` dict |
| 半衰期 | `τ₀.₅` 标量 + `[τ_lower, τ_upper]` CI |
| 最终报告 | `DecayReport` — 含图表和推荐再平衡频率 |

## 按需加载

| 何时读 | 文件 |
|---|---|
| 想看衰减模型推导 | `references/decay-models.md` |
| 输出报告格式 | `references/report-format.md` |
| Bootstrap 实现细节 | `references/bootstrap.md` |

## QA 检查清单

- [ ] train/val/test 完全隔离，IC 曲线拟合没用 test？
- [ ] 至少覆盖了 5 个持有期（含 1d 和 20d）？
- [ ] 半衰期带有 Bootstrap 置信区间？
- [ ] 换手衰减和 IC 衰减一起分析了？
- [ ] 衰减曲线形状合理（单调递减）？
- [ ] 报告给出了推荐再平衡频率？
- [ ] 若半衰期 < 2 天，已标记警告？

## 跨工具适配

- Cursor → `agents/cursor-rule.mdc`
- 无原生 skill 机制 → `agents/portable-loader.md`

---

## 项目边界（量化研究合规声明）

> 按 QUANTSKILLS 社区规则 §8 声明。

- **数据来源**：本 skill 不附带任何市场数据、因子数据或评价结果；使用者需自行准备合法数据。
- **假设与参数**：默认分析对象是截面标准化后的因子信号，IC 衰减拟合使用 train+val 段，test 严格不可见。
- **已知限制**：衰减特征高度依赖样本期和市场状态；半衰期在不同牛熊市中可能显著不同；单一时间窗口的衰减分析不能替代滚动窗口的稳定性检验。
- **风险边界**：衰减报告中的半衰期和最优再平衡频率仅反映历史数据统计特征，不代表未来表现。
- **用途定位**：仅供量化研究、教育与方法论参考。不构成任何形式的投资建议、交易信号或获利保证。
