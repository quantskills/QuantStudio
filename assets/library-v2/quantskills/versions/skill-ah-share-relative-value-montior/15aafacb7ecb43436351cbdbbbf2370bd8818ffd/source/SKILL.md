---
name: ah-share-relative-value-montior
description: Monitor and research relative valuation between dual-listed A-share and H-share securities using bundled scripts, PandaData, and HKMA FX data. Use when analyzing A/H premiums or discounts, FX-adjusted price gaps, historical premium percentiles and z-scores, cross-market dislocations, daily lead-lag proxies, market-wide A/H scans, single-company A/H questions, or company-name-to-code lookup for mainland China and Hong Kong listings. Prefer the skill's scripts and normalized CSVs; never browse unrelated webpages or manually scrape public sites for this skill. If PandaData or live data access fails, fail closed instead of searching the web. Produce reproducible JSON and Markdown research outputs; do not present price gaps as guaranteed arbitrage or place trades.
quantSkills:
  organization: QuantSkills
  repository: skill-ah-share-relative-value-monitor
  collection: cross-market-relative-value
  license: GPL-3.0-only
  project_type: skill
  category: monitor
  tags:
    - a-share
    - h-share
    - ah-premium
    - relative-value
    - cross-market
    - fx
    - lead-lag
  platforms:
    - codex
    - claude-code
    - cursor
    - hermes
    - openclaw
  language: zh-en
  status: active
  validation_level: runnable
  maintainer_type: community
  summary_zh: 监控A/H双重上市股票的汇率调整溢价、历史极值、脱钩与日频价格发现关系。
  summary_en: Monitor FX-adjusted A/H premiums, historical extremes, dislocations, and daily cross-market price-discovery proxies.
---

# A/H Share Relative Value Monitor

## Mission

Analyze the same issuer across mainland A shares and Hong Kong H shares with explicit FX conversion, date alignment, and uncertainty controls. Compress the result into a reproducible relative-value report instead of treating a raw premium as a trading signal.

Use the user's language for explanations. Keep field names and commands unchanged when reproducibility matters.

## Scope boundary

Use this skill for:

- current A/H premium or discount scans across dual-listed issuers;
- historical premium percentile, standard z-score, robust z-score, and dislocation state;
- widening/compression diagnostics over 1/5-day horizons;
- daily close-to-close A-versus-H lead-lag proxies;
- checking whether a quoted platform premium matches an independently recomputed FX-adjusted premium.

Do not use this skill to:

- claim risk-free arbitrage or guaranteed convergence;
- compare unrelated A and H companies merely because names look similar;
- execute trades, route orders, borrow stock, or estimate executable arbitrage PnL;
- infer intraday price discovery from daily closes.

## Core formula

For a 1:1 economic share ratio:

```text
H_equivalent_CNY = H_price_HKD * HKD_CNY
A_H_premium = A_price_CNY / H_equivalent_CNY - 1
```

If one A share does not represent the same economic interest as one H share, pass `--share-ratio`. Define the ratio as **H-share economic units per one A-share unit**. The script multiplies the H equivalent by this ratio before comparing. Default to `1.0` only when the share rights are known to be comparable.

## Non-negotiable data controls

1. Compare only verified A/H pairs of the same issuer.
2. Use raw/unadjusted market prices for contemporaneous premium measurement. Do not mix adjusted A prices with raw H prices.
3. For historical research, intersect A and H trading dates. Never forward-fill one market's stale close through a holiday or suspension.
4. Permit FX carry-forward only from the most recent published HKD/CNY fixing and record `fx_stale_days`; default maximum is 3 calendar days.
5. Treat ex-dividend, rights, splits, suspensions, and asynchronous corporate actions as possible mechanical premium jumps. Do not label them mispricing without checking the event.
6. Distinguish live/near-live quotes from daily historical closes. PandaData-based daily snapshots and HKMA FX are monitoring data, not execution-grade quotes.
7. Record the share-ratio assumption and FX source in every material report.
8. Do not compare premium statistics across regimes with materially different capital controls, index membership, or corporate structure without noting the break.

## Standard workflow

Prefer the bundled scripts over ad hoc web browsing or manual page scraping. If a script can answer the question, use it. Do not fall back to browser-based research for this skill; if PandaData or the bundled workflow is unavailable, explain the failure clearly and stop.

Runtime split:

- `scripts/analyze_pair.py` and `scripts/scan_snapshot.py` are stdlib-only and can run with plain `python`.
- `scripts/lookup_pair.py`, `scripts/fetch_live.py`, `scripts/fetch_history.py`, and `scripts/today_market_scan.py` use the public PandaData SDK plus HKMA FX data; run them with `uv run python ...` after `uv sync`.
- If `PANDA_DATA_USERNAME` and `PANDA_DATA_PASSWORD` are available in the environment or a local `.env`, the live PandaData client will use them automatically.
- Do not ask the user to preinstall Python packages inside Codex. Let `uv` create the ephemeral environment when live data is needed.
- When running inside a sandboxed host, set `UV_CACHE_DIR` to a writable directory under the Skill root, such as `$PWD/.uv-cache` (PowerShell: `$env:UV_CACHE_DIR = "$PWD\.uv-cache"`). A cache change fixes only local cache permissions; it does not grant network access.
- If the host blocks outbound access to PandaData or HKMA, request one approved rerun of the same live command. Do not treat a sandbox network error as a data-source failure, and do not switch to web search or an old local snapshot.

Hard stop rule:

- If PandaData install or live-data retrieval fails, do not search the web, do not inspect public market pages, and do not infer live market state from search snippets.
- Return a clear "live data unavailable in this environment" message and ask the user whether to retry later or use a provided CSV/snapshot.
- Do not autonomously analyze any repository-local `ah_snapshot.csv` after a live failure. The bundled `references/pair_universe.csv` is only an identifier map; it is not a price snapshot. A current snapshot is usable only when the current fetch command successfully writes it to the requested output directory, or when the user explicitly supplies a local CSV for analysis.

For natural-language use, do not require the user to provide stock codes. If the user gives only a company name, first resolve the A/H pair from the A+H snapshot with `scripts/lookup_pair.py`, `scripts/fetch_live.py --company`, or `scripts/fetch_history.py --company`. Ask for clarification only when the company name is ambiguous or no confident A/H match exists.

### A. Current cross-sectional scan

1. Obtain a normalized snapshot with `company,h_code,h_price_hkd,a_code,a_price_cny,fx_hkd_cny`.
   The repository's `references/pair_universe.csv` contains only the A/H identity map. It must not be presented as current market data.
2. If using the bundled live workflow, run:

```bash
uv run python scripts/today_market_scan.py --out-dir out
```

This writes both the raw snapshot and the market summary. For a single-company current snapshot, use the company name directly:

```bash
uv run python scripts/fetch_live.py --company "中国平安" --out ah_snapshot.csv
```

3. Recompute every premium independently:

```bash
python scripts/scan_snapshot.py ah_snapshot.csv --json snapshot_report.json --md snapshot_report.md
```

4. Review cross-sectional median, p10/p90, dispersion, A-share discounts, and source-vs-recomputed discrepancies.
5. Do not call a pair historically extreme without pair-specific history.

### B. Pair historical study

1. Prepare a CSV with at least `date,a_price_cny,h_price_hkd,fx_hkd_cny`.
2. Optionally fetch aligned history:

```bash
uv run python scripts/fetch_history.py \
  --company "中国平安" \
  --start-date 20240101 --end-date 20261231 \
  --out pingan_ah_history.csv
```

3. Analyze it:

```bash
python scripts/analyze_pair.py pingan_ah_history.csv \
  --json pair_report.json --md pair_report.md
```

4. Interpret the largest available 20/60/250-observation window, preferring 250 when available.
5. Report both standard and robust z-scores. When they disagree materially, explain that outliers are influencing the standard estimate.
6. Treat the lead-lag result as a **daily timing proxy**, not causal evidence. H shares close later than A shares on normal trading days, creating a structural timing asymmetry.

## Deterministic metrics

`analyze_pair.py` returns:

- current FX-adjusted A/H premium in percent;
- 1-day and 5-observation premium change in percentage points;
- 20/60/250-observation mean, median, percentile, standard z-score, robust MAD z-score;
- `dislocation_score` from 0 to 100, driven by z-score magnitude and percentile extremity;
- `relative_value_state`: `extreme-a-premium`, `elevated-a-premium`, `balanced`, `elevated-a-discount`, or `extreme-a-discount`;
- same-day return correlation and A-to-H / H-to-A next-observation lead-lag correlations;
- data-quality warnings and flags.

`scan_snapshot.py` returns:

- number of valid A/H pairs;
- cross-sectional premium median, p10, p90, and p90-p10 dispersion;
- count of A-share discounts;
- highest and lowest recomputed premiums;
- rows whose independently recomputed premium differs materially from the source-reported premium.

Read [references/methodology.md](references/methodology.md) for formulas and thresholds. Read [references/data-contract.md](references/data-contract.md) before adapting external data. Read [references/data-sources.md](references/data-sources.md) when using the live data sources.

## Minimum result contract

Every final research response must include:

1. issuer and A/H codes;
2. observation date and data freshness;
3. A price, H price, HKD/CNY rate, share-ratio assumption, and recomputed premium;
4. the historical window actually available;
5. percentile and z-score context, or an explicit statement that history is insufficient;
6. dislocation state and flags;
7. lead-lag proxy only when sample size is adequate;
8. limitations: market-hour asymmetry, corporate actions, capital controls, liquidity, borrow/short constraints, taxes, settlement, and non-fungibility where relevant;
9. the statement: **Research/education only; not investment advice and not a claim of executable arbitrage.**

## Failure modes to catch explicitly

- Multiplying or dividing the HKD/CNY conversion in the wrong direction.
- Using 100 HKD/CNY fixing values without dividing by 100.
- Comparing an A close from today with an H close from a previous market day.
- Treating any source-reported premium field as ground truth without independent recomputation.
- Comparing adjusted prices on one venue with unadjusted prices on the other.
- Ignoring ex-dividend dates or different dividend timetables.
- Calling a high historical percentile a guaranteed mean-reversion trade.
- Calling a daily lead-lag correlation "causality" or "alpha".
- Ignoring that shorting, Stock Connect eligibility, quotas, settlement, taxes, custody, and capital controls can make apparent gaps non-executable.

## Example

Run the bundled synthetic example:

```bash
python scripts/analyze_pair.py examples/sample_pair_history.csv \
  --company "Synthetic Dual List Co" --a-code DEMOA --h-code DEMOH

python scripts/scan_snapshot.py examples/sample_snapshot.csv
```

The example data are synthetic and exist only to demonstrate the computation contract.
