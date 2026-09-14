# A/H Share Relative Value Monitor

Research the FX-adjusted relative valuation of the same issuer's mainland A share and Hong Kong H share.

This skill supports:

- Current A/H premium and discount scans
- Company-name lookup for verified A/H pairs
- Historical premium percentiles and z-scores
- Cross-market dislocation analysis
- Daily A-to-H and H-to-A lead-lag proxies

This is a research workflow. It does not execute trades, promise convergence, or claim that a price gap is executable.

## Supported Runtimes

The repository includes entrypoints for Codex, Claude Code, Cursor, Hermes, and OpenClaw. The canonical operating instructions are in `SKILL.md`.

## Quick Start

### uv

```bash
uv sync
uv run python scripts/today_market_scan.py --out-dir out
```

On Windows, use a repository-local cache when the default uv cache is not writable:

```powershell
$env:UV_CACHE_DIR = "$PWD\\.uv-cache"
uv sync
```

### pip

```bash
python -m pip install -r requirements.txt
python scripts/today_market_scan.py --out-dir out
```

Python 3.10 or newer is recommended.

## Credentials

Live fetching uses PandaData and HKMA FX data. Put credentials in the environment or in a local `.env` file:

```text
PANDA_DATA_USERNAME=your_username
PANDA_DATA_PASSWORD=your_password
```

`.env` is local-only and is excluded by `.gitignore`. Never commit credentials, tokens, or private endpoints.

## Common Commands

Run a current market-wide scan:

```bash
uv run python scripts/today_market_scan.py --out-dir out
```

Fetch one company by name; stock codes are optional:

```bash
uv run python scripts/fetch_live.py --company "中国平安" --out pingan_snapshot.csv
```

Fetch aligned history:

```bash
uv run python scripts/fetch_history.py \
  --company "中国平安" \
  --start-date 20240101 \
  --end-date 20261231 \
  --out pingan_ah_history.csv
```

Analyze a local history file:

```bash
python scripts/analyze_pair.py pingan_ah_history.csv \
  --json pair_report.json \
  --md pair_report.md
```

Offline examples are available under `examples/` and do not require network access.

## Method

For a 1:1 economic share ratio:

```text
H_equivalent_CNY = H_price_HKD * HKD_CNY
A_H_premium = A_price_CNY / H_equivalent_CNY - 1
```

Historical analysis intersects A-share and H-share trading dates. FX carry-forward is limited and recorded. Prices are raw monitoring closes, not execution-grade quotes.

## Data Policy

The skill uses the bundled scripts, PandaData, and the HKMA public FX endpoint. It does not replace unavailable live data with web searches, manually scraped pages, or stale repository snapshots. When an approved live source fails, it reports that live data is unavailable.

## Limitations

Market-hour differences, corporate actions, capital controls, liquidity, short-sale availability, borrowing costs, taxes, settlement, custody, and non-fungibility can make an observed gap non-executable. A historical percentile is not a forecast or a trading signal.

Research and education only. This project does not provide personalized financial guidance or trade execution.

## License

GPL-3.0-only. See `LICENSE`.

