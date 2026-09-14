# Batch Conversion Guide

Use this reference when converting **multiple** JoinQuant strategies in a single pass (directory or file list).

## Overview

Batch conversion follows a 3-stage process:
1. **Scan & Classify** — Discover all files, classify by pattern type
2. **Convert** — Convert each file independently using the single-file workflow
3. **Assemble** — Combine into a unified output directory with summary report

## Stage 1: Scan & Classify

### File Discovery

Scan the given directory recursively for `.py` files:

```python
import os
jq_files = [f for f in os.listdir(dir_path) if f.endswith('.py') and not f.startswith('_')]
```

### Classification Algorithm

For each file, scan for these pattern signatures (in priority order):

```python
def classify_strategy(source_code):
    # Check in order of specificity
    if 'sm.OLS' in source_code or 'statsmodels.api' in source_code:
        return 'stat_model'
    if 'set_subportfolios' in source_code or 'futures_margin_rate' in source_code:
        return 'futures'
    if 'get_fundamentals' in source_code and 'order_target_value' in source_code:
        return 'factor_fund'
    if 'get_index_stocks' in source_code and len(source_code) > 5000:
        return 'custom_pool'
    if 'run_daily' in source_code and 'attribute_history' in source_code:
        return 'simple_ma'
    return 'fallback'
```

### Batch Plan Template

After scanning, produce a plan:

```markdown
## Batch Conversion Plan

| File | Type | Lines | Difficulty | Notes |
|------|------|-------|-----------|-------|
| 38081.py | futures | 450 | ⭐⭐⭐ | Multi-futures strategy |
| 38088.py | factor_fund | 280 | ⭐⭐ | PEG stock selection |
| 38131.py | simple_ma | 45 | ⭐ | Simple timing |
| ... | ... | ... | ... | ... |

**Difficulty scale**:
- ⭐ = Simple mapping, direct Format B output
- ⭐⭐ = Some adaptation needed, stateful logic  
- ⭐⭐⭐ = Major structural differences, requires Format A
- ⭐⭐⭐⭐ = Limited PandaAI support (e.g., futures), creative workaround needed
```

## Stage 2: Convert

### Per-File Conversion

Each file follows the standard workflow (see `SKILL.md` Phase 1-4), with one addition: **assign a unique strategy name**.

**Naming convention**:
```
{original_filename_stem}_{pattern_type}
```

Examples:
- `38081_futures_multi`
- `38088_peg_selection`
- `38131_simple_ma`

### Strategy Name Deduplication

For batch mode, append the original filename stem to the strategy name to avoid collisions:

```python
strategy_name = f"{original_name}_{pattern_type}"
```

### Output Format Decision

Based on classification:

| Type | PandaAI Output | Reason |
|------|---------------|--------|
| `simple_ma` | Format B (JSON config) | Clean signal/condition mapping |
| `factor_fund` | Format B with pre-loaded factors | Factors loaded in strategy_content |
| `stat_model` | Format A (code_blocks) | Statsmodel/OLS, stateful |
| `futures` | Format A (code_blocks) + warning | PandaAI may not support futures |
| `custom_pool` | Format A (code_blocks) | Dynamic stock selection |
| `fallback` | Format A (code_blocks) | Conservative choice |

## Stage 3: Assemble Output

### Combined JSON Format

Create a single `panda_strategies.json` as a **PandaAI-compatible array**:

```json
[
  {
    "index": 0,
    "name": "38081_futures_multi",
    "description": "...original title and author...",
    "workflow_type": ["stock_backtest"],
    "code_blocks": [{ "node_title": "Python交易代码", "code_lines": ... }]
  },
  {
    "index": 1,
    "name": "38088_peg_selection",
    "description": "...",
    "workflow_type": ["stock_backtest", "factor_build"],
    "code_blocks": [{ "node_title": "Python交易代码", "code_lines": ... }]
  },
  ...
]
```

**index** values should be sequential starting from 0.

### Summary Report Template

Create `conversion_summary.md`:

```markdown
# Batch Conversion Summary: {directory_name}

**Total strategies**: {N}
**Conversion date**: {date}
**Source**: {directory_path}

## Classification Distribution

| Type | Count | Files |
|------|-------|-------|
| simple_ma | {n} | file1.py, file2.py |
| factor_fund | {n} | ... |
| stat_model | {n} | ... |
| futures | {n} | ... |
| custom_pool | {n} | ... |
| fallback | {n} | ... |

## Conversion Results

| # | File | Name | Type | Status | Output Format | Notes |
|---|------|------|------|--------|---------------|-------|
| 0 | 38081.py | futures_multi | futures | ⚠️ Partial | A | Futures not supported in PandaAI |
| 1 | 38088.py | peg_selection | factor_fund | ✅ | B | Stock pool → static list needed |
| ... | ... | ... | ... | ... | ... | ... |

## API Usage Heatmap

| API | Used Count | PandaAI Equivalent | Availability |
|-----|-----------|-------------------|-------------|
| `attribute_history` | 12/18 | `get_market_data()` | ✅ Full |
| `get_fundamentals` | 8/18 | `get_factor()` | ✅ Full |
| `order_target_value` | 10/18 | `order_shares()` | ✅ With adaptation |
| `get_index_stocks` | 6/18 | static list | ⚠️ Semi |
| `get_price` | 4/18 | `get_market_data()` | ✅ Full |
| `run_daily` | 15/18 | handle_data | ✅ With adaptation |
| `run_monthly` | 5/18 | context.run_day check | ⚠️ Semi |
| `sm.OLS` | 2/18 | same library | ✅ Full |
| `set_subportfolios` | 1/18 | N/A | ❌ None |

## Common Conversion Issues

1. **Futures** (1 file): PandaAI doesn't support futures contracts natively. Strategy 38081.py uses `get_price(contract, ...)` for futures — need creative adaptation or platform limitation note.
2. **Dynamic stock pool** (6 files): JQ's `get_index_stocks()` is dynamic by date. PandaAI requires static lists or code_blocks-based iteration.
3. **Minute-level strategies** (2 files): Need `trade_freq: 'minute'` for Format B, or manual time-check logic in Format A.
4. **All strategies use `run_daily`/`run_weekly`/`run_monthly`**: All need adaptation to PandaAI's handle_data-only scheduling.

## Warnings

- {N} strategies flagged with ⚠️ Partial — code converted but may need manual tweaks
- Futures strategy requires platform-level futures support
- Backtest results WILL differ between platforms (data sources, fill algorithms, commission models differ)

## Output Files

| File | Description |
|------|-------------|
| `panda_strategies.json` | All {N} converted strategies, ready for bulk import |
| `strategies/{filename}.json` | Individual per-strategy configs |
| `reports/{filename}_report.md` | Individual conversion reports |
```

### Individual File Output

For each converted strategy, produce two files:

**`strategies/{filename_stem}_panda.json`** — Single-strategy JSON:
```json
{
  "index": 0,
  "name": "38088_peg_selection",
  "description": "PEG选股 ...",
  "workflow_type": ["stock_backtest", "factor_build"],
  "code_blocks": [
    {
      "node_title": "Python交易代码",
      "code_lines": 200,
      "code": "..."
    }
  ]
}
```

**`reports/{filename_stem}_report.md`** — Individual conversion report (same structure as single-file version).

## Batch Special Cases

### Mixed-format output

If the batch contains strategies that need different formats (Format A vs Format B), output **all** in Format A's `code_blocks` structure for consistency. This makes the combined JSON file uniform and importable.

Alternatively, produce two separate combined files:
- `panda_strategies_formatA.json` — code_blocks strategies
- `panda_strategies_formatB.json` — declarative strategies

### Duplicate detection

If the same strategy logic appears in multiple files (slightly different parameterization), output a note in the summary but still convert each independently.

### Utility/shared modules

Files that don't contain `def initialize(context)` are likely utility modules rather than strategies. Skip these and list them in the summary as "utilities skipped."
