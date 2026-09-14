# Multi-Platform Install Guide

This package contains one GNN stock selection skill:

- `skill-dl-gnn-stock-graph`: Callable DL skill for A-share quantitative stock selection using Graph Neural Networks.

---

## Claude Code

Copy this entire repository directory to your Claude Code skills folder:

```bash
# macOS / Linux
cp -R skill-dl-gnn-stock-graph ~/.claude/skills/
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$HOME\.claude\skills"
Copy-Item ".\" "$HOME\.claude\skills\skill-dl-gnn-stock-graph" -Recurse -Force
```

After installation, invoke in Claude Code:

```
/skill-dl-gnn-stock-graph
```

Or call from any agent via Python import:

```python
import sys
sys.path.insert(0, "~/.claude/skills/skill-dl-gnn-stock-graph")
from scripts.scan import run_single_day
```

Requirements: Python 3.10+, PyTorch 2.0+, panda_data (account required). See `requirements.txt`.

---

## Codex (OpenAI)

This skill can be used as a function/tool definition for OpenAI Codex agents.

### As a Codex Tool

Add to your Codex SDK configuration:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "skill_dl_gnn_stock_graph",
        "description": "A-share GNN quantitative stock selection. Builds multi-layer heterogeneous graphs (industry/concept/DTW/correlation), trains GATs_ts or MF-IAMGCN models on trailing windows, and outputs TopK stock picks. Supports CSI300/CSI500/CSI1000. Input: target date, model name, lookback days, top_k. Output: ranked stock list with scores, sectors, and market caps.",
        "parameters": {
          "type": "object",
          "properties": {
            "date": {
              "type": "string",
              "description": "Scan date YYYYMMDD. Defaults to latest trading day."
            },
            "model": {
              "type": "string",
              "enum": ["gats_ts", "mf_iamgcn"],
              "description": "GNN model architecture."
            },
            "index": {
              "type": "string",
              "description": "Stock universe index (000300.SH / 000905.SH / 000852.SH)."
            },
            "top_k": {
              "type": "integer",
              "description": "Number of stocks to select."
            },
            "epochs": {
              "type": "integer",
              "description": "Training epochs (default 100)."
            }
          },
          "required": ["date", "model"]
        }
      }
    }
  ]
}
```

### Running Locally

```bash
cd skill-dl-gnn-stock-graph
export PANDA_DATA_USERNAME=<your_username>
export PANDA_DATA_PASSWORD=<your_password>
python3 scripts/scan.py --date 20260731 --model gats_ts --top_k 30
```

From Python:

```python
import sys
sys.path.insert(0, "/path/to/skill-dl-gnn-stock-graph")
from scripts.scan import run_single_day
import argparse

args = argparse.Namespace(
    date="20260731", model="gats_ts", index="000300.SH",
    lookback=20, train_days=120, top_k=30, epochs=10,
    batch_size=64, seed=42, backtest=False,
    config="config/model_config.yaml", output_dir="output",
)
ret = run_single_day(args)
# Results in output/gnn_picks_20260731.csv + .md
```

---

## Cursor

This skill is compatible with Cursor's custom tools and `.cursorrules`.

### As a Cursor Tool

Add to `.cursor/tools.json` or your project's tool configuration:

```json
{
  "name": "gnn-stock-graph",
  "description": "A-share GNN quantitative stock selection with multi-layer heterogeneous graphs",
  "command": "python3",
  "args": ["${WORKSPACE}/skill-dl-gnn-stock-graph/scripts/scan.py", "--date", "${date}", "--model", "${model}", "--top_k", "${top_k}"],
  "env": {
    "PANDA_DATA_USERNAME": "${PANDA_DATA_USERNAME}",
    "PANDA_DATA_PASSWORD": "${PANDA_DATA_PASSWORD}"
  }
}
```

### As a Cursor Rule

Add to `.cursorrules`:

```
When the user asks about stock selection, GNN-based quantitative trading, graph neural networks for A-shares, or ranking stocks by predicted return, use the gnn-stock-graph skill.

Run: python3 skill-dl-gnn-stock-graph/scripts/scan.py --date <YYYYMMDD> --model gats_ts --top_k <N>

The skill outputs CSV + Markdown files in output/.
```

---

## Hermes

This skill integrates with Hermes as a callable Python module.

### Registering the Skill

In your Hermes skill registry:

```yaml
# hermes_skills.yml
skills:
  dl-gnn-stock-graph:
    name: skill-dl-gnn-stock-graph
    type: dl
    runtime: python3
    entry: skill-dl-gnn-stock-graph/scripts/scan.py
    description: >
      A-share GNN quantitative stock selection. Builds multi-layer
      heterogeneous graphs, trains GATs_ts/MF-IAMGCN, and outputs
      TopK ranked stock picks with scores and sector distributions.
    input_schema:
      type: object
      properties:
        date:
          type: string
          description: "Scan date YYYYMMDD"
        model:
          type: string
          enum: [gats_ts, mf_iamgcn]
        index:
          type: string
          enum: ["000300.SH", "000905.SH", "000852.SH"]
        top_k:
          type: integer
          minimum: 1
          maximum: 100
        epochs:
          type: integer
          default: 100
      required: [date, model]
    constraints:
      - PyTorch 2.0+ required
      - panda_data account required
      - research and educational use only
```

### Calling from Hermes

```python
response = hermes.call_skill("dl-gnn-stock-graph", {
    "date": "20260731",
    "model": "gats_ts",
    "top_k": 30,
    "epochs": 20,
})
# Returns path to output CSV + Markdown
```

---

## OpenClaw

This skill can be registered as an OpenClaw tool.

### Tool Configuration

```yaml
# openclaw_tools.yaml
- name: gnn_stock_graph
  description: >
    A-share GNN quantitative stock selection with dual model architecture
    (GATs_ts + MF-IAMGCN). Builds heterogeneous graphs across five edge
    types and five-dimensional features. Outputs TopK picks with CSV/MD.
  type: local
  runtime: python3
  entrypoint: skill-dl-gnn-stock-graph/scripts/scan.py
  schema:
    input:
      type: object
      required: [date, model]
      properties:
        date: {type: string, description: "Scan date YYYYMMDD"}
        model: {type: string, enum: [gats_ts, mf_iamgcn]}
        index: {type: string, default: "000300.SH"}
        lookback: {type: integer, default: 20}
        train_days: {type: integer, default: 252}
        top_k: {type: integer, default: 30}
        epochs: {type: integer, default: 100}
        seed: {type: integer, default: 42}
  env:
    PANDA_DATA_USERNAME: "${PANDA_DATA_USERNAME}"
    PANDA_DATA_PASSWORD: "${PANDA_DATA_PASSWORD}"
  limits:
    max_symbols_per_call: 500
  notes: |
    Research and educational use only. No investment advice.
    Requires PyTorch 2.0+ and panda_data account.
```

---

## Environment Setup

The skill requires the panda_data API credentials. Before first run:

```bash
# Add to ~/.zshrc or ~/.bashrc
export PANDA_DATA_USERNAME=<your_panda_data_username>
export PANDA_DATA_PASSWORD=<your_panda_data_password>
```

Then verify connectivity:

```bash
cd skill-dl-gnn-stock-graph
python3 -m scripts.data.loader --self-check --date $(python3 -c "from scripts.data import loader; print(loader.get_last_trade_date() or '20260731')")
```

Check `requirements.txt` for Python package dependencies.

---

## Usage Boundaries (All Platforms)

- **Research & educational use only** — not investment advice.
- **Requires panda_data account** for A-share market data, fundamentals, and index constituents.
- **Requires PyTorch 2.0+** for GNN training and inference.
- Stock selection signals are probabilistic predictions; they do not guarantee future returns.
- Backtest performance includes simulated costs (commission, stamp tax, slippage) but does not account for market impact, liquidity constraints, or execution uncertainty.
- See `SKILL.md` for full architecture and `README.md` / `README.en.md` for project overview.
