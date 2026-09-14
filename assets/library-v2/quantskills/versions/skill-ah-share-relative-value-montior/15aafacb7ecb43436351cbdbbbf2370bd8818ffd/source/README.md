# A/H Share Relative Value Monitor

English version: [README.en.md](README.en.md)

> 用自然语言研究同一家公司的 A 股与 H 股：**现在差多少、历史上算不算极端、整个 A/H 市场谁最贵/最便宜、两地谁更领先。**

这个 Skill 面向 A+H 双重上市公司，自动处理汇率、共同交易日、历史分位和跨市场价格关系。

**你不需要先研究 `scripts/` 目录，也不需要自己决定脚本调用顺序。** 作为用户，直接说你想研究什么即可；Skill 会根据你的问题选择数据和分析流程。

支持平台：Claude Code、Codex、Cursor、Hermes、OpenClaw。

---

## 你可以用它做什么？

最常见的是下面 4 类场景。

### 场景 1：扫描今天整个 A/H 市场

你想知道：

- 今天 A 股相对 H 股整体贵不贵？
- 哪些 A/H 公司当前溢价最高？
- 有没有 A 股相对 H 股出现折价？
- 今天 A/H 价差分布是不是特别分散？

你可以直接问：

> 帮我看看今天 A/H 股整体溢价情况。

> 扫描今天所有 A+H 公司，列出 A 股相对 H 股溢价最高和最低的 10 家。

> 今天 A/H 市场有没有明显的跨市场定价异常？

Skill 会自动完成：

```text
获取当前 A/H 快照
        ↓
统一 HKD/CNY 汇率口径
        ↓
独立重算每一对 A/H 溢价
        ↓
统计市场中位数 / P10 / P90 / 离散度
        ↓
找出最高溢价、最大折价和异常数据
```

典型输出包括：

```text
有效 A/H 对数量
市场 A/H 溢价中位数
P10 / P90
A 股折价公司数量
溢价最高 / 最低公司
源数据溢价与独立重算值是否一致
```

---

### 场景 2：看某一家公司的当前 A/H 价差

你想知道：

- 同一家公司的 A 股和 H 股现在差多少？
- 汇率换算以后，A 股到底比 H 股贵多少？
- 当前是否出现明显跨市场脱钩？

你可以直接问：

> 中国平安现在 A 股比 H 股贵多少？

> 帮我比较 601318 和 02318 当前的 A/H 溢价。

> 看看这家公司 A/H 两边现在有没有明显脱钩。

Skill 会自动：

1. 确认 A/H 是同一发行人；
2. 获取或读取两地价格；
3. 获取 HKD/CNY；
4. 把 H 股价格换算成人民币等价值；
5. 独立计算 A/H premium；
6. 解释结果，但不会把价差直接描述成“套利机会”。

输出大致会是：

```text
公司：XXX
A 股：601318
H 股：02318

A 股价格：XX CNY
H 股价格：XX HKD
HKD/CNY：XX

汇率调整后 H 股等价值：XX CNY
A/H 溢价：+XX%

当前状态：A 股明显溢价 / 接近平衡 / A 股折价
```

---

### 场景 3：判断某个 A/H 价差历史上是否极端

这是本 Skill 最核心的研究场景。

单看“今天溢价 30%”意义有限，更重要的是：

> **30% 对这家公司自己来说，到底是正常水平，还是历史极端？**

你可以直接问：

> 中国平安现在的 A/H 溢价在过去一年算高吗？

> 看一下 601318 / 02318 最近 250 个共同交易日的 A/H 溢价分位。

> 这家公司最近 A/H 价差是不是在快速扩大？

> 找出过去一年这家公司 A/H 脱钩最严重的时候。

Skill 会自动完成：

```text
获取 A 股历史价格
        +
获取 H 股历史价格
        +
获取 HKD/CNY 历史汇率
        ↓
只保留两地共同交易日
        ↓
生成每日 A/H premium 序列
        ↓
计算 20 / 60 / 250 日历史统计
        ↓
判断当前价差是否极端
```

核心指标包括：

- 当前 A/H 溢价；
- 1 日、5 日溢价变化；
- 20 / 60 / 250 日 percentile；
- standard z-score；
- robust MAD z-score；
- `dislocation_score`（0–100）；
- 相对价值状态。

状态可能是：

```text
extreme-a-premium
 elevated-a-premium
 balanced
 elevated-a-discount
 extreme-a-discount
```

例如：

```text
Current A/H premium:   25.91%
250d percentile:       100.0%
250d robust z:         +2.59
Dislocation score:     90.4 / 100

State:
extreme-a-premium
```

它表达的是：

> 当前 A 股相对 H 股的定价差异处在这家公司自身历史的极端区域。

它**不等于**：

> 价差一定会收敛，或者存在无风险套利。

---

### 场景 4：研究 A 股和 H 股谁更领先

适合研究跨市场价格发现。

你可以直接问：

> 最近中国平安是 A 股领先 H 股，还是 H 股领先 A 股？

> 分析一下这家公司 A/H 两地的价格发现关系。

> H 股今天的变化，对下一共同交易日 A 股有没有更强的领先关系？

Skill 会在历史数据上计算：

- 同日 A/H 收益相关性；
- A(t) → H(t+1) correlation；
- H(t) → A(t+1) correlation；
- 日频 lead-lag proxy。

例如：

```text
Same-day correlation   0.72
A(t) -> H(t+1)         0.11
H(t) -> A(t+1)         0.34

Lead-lag proxy:
H-leading
```

这里的结果只表示**日频时间关系的统计代理**，不代表因果关系，也不代表可交易 alpha。

---

## 什么样的提示词会触发这个 Skill？

当问题明确涉及**同一家公司的 A 股与 H 股跨市场相对定价**时，就适合使用。

典型问题：

```text
今天 A/H 股整体溢价怎么样？

A/H 股溢价最高的是哪些？

中国平安 A 股和 H 股现在差多少？

601318 和 02318 谁更贵？

平安现在的 A/H 溢价历史上算高吗？

这个 A/H 价差最近是不是在扩大？

A/H 两地最近谁领先谁？

帮我验证一下某个平台显示的 A/H 溢价是否算对了。
```

下面这些问题则不是本 Skill 的主要用途：

```text
分析一下中国平安值不值得买
推荐几个港股
分析整个港股市场
帮我做 A 股选股
执行 A/H 套利交易
```

---

## 我需要提供什么？

### 最简单：什么都不提供

如果运行环境可以访问 PandaData + HKMA 数据源，你只需要给出自然语言问题。

例如：

> 扫描今天所有 A/H 股。

或者：

> 看看中国平安现在的 A/H 价差。

Skill 会自己决定是否获取当前行情或历史数据。

如果问题涉及单家公司，只需要给出公司名。Skill 会先从 A+H 快照中解析公司名对应的 `a_code` / `h_code`，只有公司名过于模糊或匹配到多个候选时，才需要进一步澄清。

### 也可以直接提供股票代码（可选）

例如：

```text
A: 601318
H: 02318
```

股票代码不是自然语言使用的前置条件，只是本地调试、消除歧义或复现结果时的显式覆盖。

### 也可以上传自己的 CSV

如果你已经有行情数据，Skill 会优先使用你明确提供的数据，不需要重新联网抓取。

注意：仓库内的 `references/pair_universe.csv` 只是公司名、A 股代码和 H 股代码的配对名单，不是行情快照。实时取数失败时，Skill 不会自动把旧快照当成今天的数据；只有你明确提供本地 CSV 时，才会分析本地快照。

历史数据最小字段：

```text
date,a_price_cny,h_price_hkd,fx_hkd_cny
```

市场快照最小字段：

```text
company,h_code,h_price_hkd,a_code,a_price_cny,fx_hkd_cny
```

---

## Skill 内部是怎么自动选择流程的？

用户不需要记脚本名。内部逻辑可以理解为：

```text
                    你的问题
                       │
                       ▼
             是否涉及同公司 A/H？
                       │
                ┌──────┴──────┐
                │             │
               是             否
                │         不使用本 Skill
                ▼
             当前 or 历史？
                │
         ┌──────┴──────┐
         │             │
        当前           历史
         │             │
         ▼             ▼
      有数据？       有数据？
       │   │          │   │
      有   无         有   无
       │   │          │   │
       ▼   ▼          ▼   ▼
     直接  获取      直接  获取
     分析  快照      分析  历史
```

也就是说，**scripts 是 Skill 的内部实现，不是用户菜单。**

---

## 对开发者 / Reviewer：脚本如何对应这些场景？

如果你是在本地调试或验收 Skill，可以直接运行脚本。

### 1. 当前全市场扫描

```bash
uv run python scripts/today_market_scan.py --out-dir out
```

对应用户场景：

> 今天 A/H 股整体怎么样？

> 哪些公司 A/H 溢价最高？

如果只看单家公司，可以直接用公司名过滤：

```bash
uv run python scripts/fetch_live.py --company "中国平安" --out pingan_snapshot.csv

python scripts/scan_snapshot.py pingan_snapshot.csv \
  --json pingan_snapshot_report.json \
  --md pingan_snapshot_report.md
```

### 2. 单公司历史相对价值研究

```bash
uv run python scripts/fetch_history.py \
  --company "中国平安" \
  --start-date 20240101 \
  --end-date 20261231 \
  --out pingan_ah_history.csv

python scripts/analyze_pair.py pingan_ah_history.csv \
  --json pair_report.json \
  --md pair_report.md
```

`fetch_history.py --company` 会自动解析 A/H 代码，并把 `company,a_code,h_code` 写入历史 CSV；后续 `analyze_pair.py` 会自动读取这些元数据。若要手工查看匹配结果，可以运行：

```bash
uv run python scripts/lookup_pair.py "中国平安"
```

也仍然可以显式传入代码：

```bash
uv run python scripts/fetch_history.py \
  --a-code 601318 \
  --h-code 02318 \
  --start-date 20240101 \
  --end-date 20261231 \
  --out 601318_02318.csv
```

对应用户场景：

> 这个价差历史上算极端吗？

> A/H 最近谁领先谁？

### 3. 用户已经提供数据

如果已有 snapshot CSV：

```bash
python scripts/scan_snapshot.py user_snapshot.csv
```

如果已有历史 pair CSV：

```bash
python scripts/analyze_pair.py user_pair_history.csv \
  --company "Example Co"
```

这种情况下不需要运行 fetch 脚本。

---

## 30 秒体验

不联网也可以直接运行内置合成数据：

```bash
python scripts/analyze_pair.py examples/sample_pair_history.csv \
  --company "Synthetic Dual List Co" \
  --a-code DEMOA \
  --h-code DEMOH
```

然后运行市场快照样例：

```bash
python scripts/scan_snapshot.py examples/sample_snapshot.csv
```

合成历史示例预期会得到接近：

```text
Current premium:       25.91%
250d percentile:       100.0%
250d robust z:         +2.59
Dislocation score:     90.4 / 100
Relative value state:  extreme-a-premium
```

示例数据仅用于验证计算流程，不代表任何真实证券。

---

## 安装

核心分析脚本只依赖 Python 标准库；联网取数由 PandaData SDK 和 HKMA 数据完成。若环境变量或本地 `.env` 提供 `PANDA_DATA_USERNAME` / `PANDA_DATA_PASSWORD`，脚本会自动使用它们登录 PandaData。

### 方式 1：用 `uv`

```bash
uv sync
```

如果 Windows 机器上的默认 `uv` 缓存目录没有权限，可以先设置：

```powershell
$env:UV_CACHE_DIR = "$PWD\.uv-cache"
uv sync
```

如果你只想跑一次，不想先落地 `.venv`，也可以直接：

```bash
uv run python scripts/today_market_scan.py --out-dir out
```

在 Codex 等带沙箱的宿主中，如果出现网络权限错误，需要让宿主批准这条实时取数命令后重试。`UV_CACHE_DIR` 只解决 uv 缓存目录权限，不会放开 PandaData 网络访问；实时接口失败时不能用旧本地快照代替今天的数据。

### 方式 2：用 `python -m pip`

```bash
python -m pip install -r requirements.txt
```

推荐 Python 3.10+。

---

## 核心计算口径

默认 1 股 A 与 1 股 H 具有相同经济权益时：

```text
H_equivalent_CNY = H_price_HKD * HKD_CNY
A_H_premium = A_price_CNY / H_equivalent_CNY - 1
```

如果 A/H 经济权益比例不是 1:1，需要显式指定 `share_ratio`。

历史研究时，Skill 会：

- 只比较 A/H 两地共同交易日；
- 不用一个市场的旧收盘价填补另一个市场的新交易日；
- 记录 FX 来源日期与陈旧天数；
- 避免一边用复权价格、另一边用原始价格；
- 对除权、分红、停牌和公司行为保持警惕。

---

## 它不是什么？

这个 Skill **不是 A/H 套利机器人**。

A 股和 H 股即使代表同一家公司的经济权益，也不是无摩擦、随时可互换的同一资产。交易时段、资本约束、Stock Connect、做空可用性、借券成本、税费、结算、托管、公司行为和流动性都可能让表面的价格差无法执行。

因此本 Skill 的目标是：

> **把 A/H 跨市场价差变成可重复、可解释、带历史上下文的研究结果。**

而不是：

> **看到价差就给出买卖建议。**

**仅供研究与教育，不构成投资建议，也不代表存在可执行套利。**
