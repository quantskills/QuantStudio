# skill-dl-gnn-stock-graph

Deep Graph Neural Network for A-Share Quantitative Stock Selection.

## Overview

A GNN-based stock ranking system that builds multi-layer heterogeneous graphs (Shenwan L1/L2/L3 industry + concept boards + institutional holdings + DTW morphology similarity + Pearson correlation) and applies dual-model architecture (GATs_ts + MF-IAMGCN) for TopK stock selection with a full A-share backtesting engine.

## Architecture

```
Data Loader  →  Graph Builder  →  Feature Pipeline  →  Model Training  →  Stock Selector  →  Backtest
(15 APIs)       (explicit+implicit)   (5-D, 32 features)  (GATs_ts/MF-IAMGCN)  (TopK + threshold)  (T+1 + costs)
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set auth
export PANDA_DATA_USERNAME=<your_username>
export PANDA_DATA_PASSWORD=<your_password>

# Field self-check (first time)
python3 -m scripts.data.loader --self-check --date 20260729

# Run tests (52 cases)
python3 -m pytest tests/ -v

# Single-day stock selection
python3 scripts/scan.py --date 20260731 --model gats_ts --train_days 120 --epochs 10 --top_k 10

# Multi-day backtest
python3 scripts/scan.py --start_date 20260101 --end_date 20260731 --model gats_ts --top_k 10 --backtest
```

## Agent Integration

```python
import subprocess
import json
from pathlib import Path

skill_root = Path(__file__).resolve().parent.parent

# Run GNN stock selection
result = subprocess.run(
    ["python3", str(skill_root / "scripts" / "scan.py"),
     "--date", "20260731", "--model", "gats_ts",
     "--top_k", "10", "--output", "json"],
    capture_output=True, text=True, cwd=str(skill_root)
)
picks = json.loads(result.stdout)
# picks: [{"symbol": "000001.SZ", "score": 0.87, "rank": 1}, ...]
```

### Universe
- CSI 300 (`000300.SH`), CSI 500 (`000905.SH`), CSI 1000 (`000852.SH`)
- Auto-filter: ST/*ST, IPO < 60 days, suspended stocks

### Graph Construction
- **Explicit edges**: industry (L1/L2/L3 weighted), concept boards, institutional co-holdings
- **Implicit edges**: DTW return similarity (Top-K), Pearson correlation (threshold), Granger causality

### Dual-Model Architecture
| Model | Description |
|-------|-------------|
| GATs_ts | RNN + Dynamic Graph Attention Network (~6-10s per run) |
| MF-IAMGCN | Mixed-Frequency Inter-Attention Multi-Layer GCN (daily + quarterly via MIDAS) |

### Feature Engineering (32 features, 5 dimensions)
- **Price** (14): ret, log_vol, amplitude, turnover, gap, dist_limit_up/down, excess_ret, mom_5d/20d, volatility_20d, macd, rsi
- **Fundamental** (7): PE, PB, ROE, revenue_growth, profit_growth, debt_ratio, market_cap
- **Sentiment** (3): lhb_flag, block_trade_flag, external_llm_score
- **Macro** (4): GDP, CPI, PMI, M2
- **Graph** (4): degree_centrality, pagerank, dtw_avg, industry_excess

### Backtest Engine
- T+1 settlement, limit-up/down constraints
- Commission 0.03% + stamp duty 0.1% (sell) + slippage 0.1%
- Equal-weight allocation, daily rebalancing
- Output: Sharpe, Sortino, Calmar, Information Ratio, Max Drawdown, Annual Turnover

### Auth Requirements
- All steps require `PANDA_DATA_USERNAME` and `PANDA_DATA_PASSWORD`
- 15 panda_data APIs used (see SKILL.md for full list)

### Data Files
```bash
# Output from scan
output/{symbol}_prediction_report_{date}.md   # Prediction markdown
output/{model}_{date}_model.pt                # Saved model checkpoint
```

### Tests
```bash
pytest tests/ -v  # 52 test cases covering calendar, cleaner, graph, features, model, strategy, backtest
```

### Dependencies
- Python 3.10+, PyTorch 2.0+, panda_data
- pandas, numpy, scikit-learn, pyyaml, pytest
