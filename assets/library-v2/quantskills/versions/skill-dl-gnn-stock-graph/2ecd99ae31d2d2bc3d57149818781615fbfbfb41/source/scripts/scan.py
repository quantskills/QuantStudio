"""Daily GNN stock selection — single-day CLI + multi-day backtest.

Usage:
    cd skill-dl-gnn-stock-graph
    python3 scripts/scan.py --date 20260729 --model gats_ts --top_k 10
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.data import loader, calendar as cal_mod, cleaner
from scripts.graph import explicit, implicit, builder
from scripts.features import pipeline as feat_pipeline
from scripts.model import train as model_train
from scripts.strategy import selector as stock_selector
from scripts.backtest import engine as bt_engine, metrics as bt_metrics
from scripts.risk import monitor as risk_monitor
from scripts import report

REPO_ROOT = Path(__file__).resolve().parents[1]


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="GNN Stock Graph — A股量化选股")
    p.add_argument("--date", default=None)
    p.add_argument("--model", default="gats_ts", choices=["gats_ts", "mf_iamgcn"])
    p.add_argument("--index", default="000300.SH")
    p.add_argument("--lookback", type=int, default=20)
    p.add_argument("--train_days", type=int, default=252)
    p.add_argument("--top_k", type=int, default=30)
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--batch_size", type=int, default=64)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--backtest", action="store_true")
    p.add_argument("--start", default=None, help="回测起始日 YYYYMMDD")
    p.add_argument("--end", default=None, help="回测结束日 YYYYMMDD")
    p.add_argument("--resume", default=None, help="从 .pt checkpoint 恢复模型")
    p.add_argument("--save_model", action="store_true", default=True, help="保存模型 checkpoint")
    p.add_argument("--no_save_model", dest="save_model", action="store_false", help="不保存模型")
    p.add_argument("--config", default=str(REPO_ROOT / "config" / "model_config.yaml"))
    p.add_argument("--output_dir", default=str(REPO_ROOT / "output"))
    return p.parse_args()


def _load_model_kwargs(config_path: str, model_name: str) -> dict:
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f) or {}
    except Exception:
        cfg = {}
    result = dict(cfg.get(model_name, {}))
    shared = cfg.get("shared", {})
    for k, v in shared.items():
        if k not in result:
            result[k] = v
    return result


def _resolve_scan_date(explicit: str | None) -> str:
    if explicit:
        return explicit
    d = loader.get_last_trade_date()
    if not d:
        print("[error] get_last_trade_date returned nothing", file=sys.stderr)
        sys.exit(2)
    return d


def _resolve_fetch_start(scan_date: str, lookback: int, train_days: int) -> str:
    n_back = lookback + train_days + 10
    d = loader.get_prev_trade_date(scan_date, n=n_back)
    if not d:
        print(f"[error] get_prev_trade_date({scan_date}, n={n_back}) failed", file=sys.stderr)
        sys.exit(2)
    return d


def _aggregate_to_nodes(sample_x: np.ndarray, sample_symbols: list[str],
                        mapper: builder.SymbolMapper, method: str = "mean") -> np.ndarray:
    """Aggregate per-window samples → per-node features for GNN input."""
    D = sample_x.shape[1]
    node_x = np.zeros((mapper.n, D), dtype=np.float32)
    count = np.zeros(mapper.n, dtype=np.int32)
    for i, sym in enumerate(sample_symbols):
        idx = mapper.index(sym)
        if idx is None:
            continue
        if method == "mean":
            node_x[idx] += sample_x[i]
            count[idx] += 1
        else:
            node_x[idx] = sample_x[i]
            count[idx] = 1
    if method == "mean":
        mask = count > 0
        node_x[mask] = node_x[mask] / count[mask].reshape(-1, 1).astype(np.float32)
    return node_x


def _build_targets(train_symbols: list[str], train_dates: list[str],
                   factor_df: pd.DataFrame, mapper: builder.SymbolMapper) -> np.ndarray:
    """Build per-node next-day-return targets for supervised training."""
    factor = factor_df.copy()
    factor["date"] = factor["date"].astype(str)
    for c in ["close", "pre_close"]:
        if c in factor.columns:
            factor[c] = pd.to_numeric(factor[c], errors="coerce")
    factor = factor.sort_values(["symbol", "date"])
    factor["next_ret"] = factor.groupby("symbol")["close"].shift(-1) / factor["close"] - 1.0
    date_ret = dict(zip(zip(factor["symbol"].astype(str), factor["date"].astype(str)), factor["next_ret"]))
    tsum = np.zeros(mapper.n, dtype=np.float64)
    tcnt = np.zeros(mapper.n, dtype=np.int32)
    for i, (sym, d) in enumerate(zip(train_symbols, train_dates)):
        idx = mapper.index(sym)
        ret = date_ret.get((sym, d), np.nan)
        if idx is not None and not np.isnan(ret):
            tsum[idx] += ret
            tcnt[idx] += 1
    return np.where(tcnt > 0, tsum / tcnt.astype(np.float64), 0.0).astype(np.float32)


def run_single_day(args: argparse.Namespace) -> int:
    model_name = args.model
    model_kwargs = _load_model_kwargs(args.config, model_name)
    graph_cfg = _load_model_kwargs(args.config, "shared")

    # ---- 1. Auth & fetch ----
    try:
        loader.init_panda_data()
        scan_date = _resolve_scan_date(args.date)
        fetch_start = _resolve_fetch_start(scan_date, args.lookback, args.train_days)
        factor_df = loader.load_factor(fetch_start, scan_date, args.index)
        post_df   = loader.load_stock_post(fetch_start, scan_date, args.index)
        index_df  = loader.load_index_daily(args.index, fetch_start, scan_date)
        weights_df = loader.load_index_weights(args.index, scan_date)
    except RuntimeError as e:
        print(f"[error] {e}", file=sys.stderr); return 1
    except ValueError as e:
        print(f"[error] field self-check: {e}", file=sys.stderr); return 4
    except Exception as e:
        print(f"[error] panda_data: {e}", file=sys.stderr); return 1

    # ---- Universe + clean ----
    uni_set: set[str] = set()
    if not weights_df.empty and "stock_symbol" in weights_df.columns:
        exact = weights_df[weights_df["date"] == scan_date]
        pool = exact if not exact.empty else weights_df[weights_df["date"] < scan_date]
        if not pool.empty:
            latest = pool["date"].max()
            uni_set = set(pool[pool["date"] == latest]["stock_symbol"].astype(str))
    universe = sorted(uni_set) if uni_set else sorted(factor_df["symbol"].unique().tolist())

    # A-share cleaning pipeline
    status_df = loader.load_stock_status_change(start_date=fetch_start, end_date=scan_date)
    float_df  = loader.load_share_float(start_date=fetch_start, end_date=scan_date)
    merged = factor_df.merge(
        post_df[["symbol", "date", "pre_close", "limit_up", "limit_down", "trade_status", "name"]],
        on=["symbol", "date"], how="inner",
    )
    merged = cleaner.clean_pipeline(merged, status_df=status_df, float_df=float_df,
                                     scan_date=scan_date, min_listed_days=60)
    factor_cols = ["symbol", "date", "open", "close", "high", "low", "volume", "amount", "turnover", "market_cap"]
    post_cols   = ["symbol", "date", "name", "pre_close", "limit_up", "limit_down", "trade_status"]
    factor_df = merged[[c for c in factor_cols if c in merged.columns]].copy()
    post_df   = merged[[c for c in post_cols if c in merged.columns]].copy()
    cleaned = set(factor_df["symbol"].unique())
    universe = sorted(cleaned & uni_set) if uni_set else sorted(cleaned)
    if not universe:
        universe = sorted(cleaned)
    print(f"[info] universe: {len(universe)} stocks after cleaning", file=sys.stderr)

    # ---- 2. Graph ----
    industry_df = loader.load_industry_constituents()
    # Per-stock concept pull to stay within plan limits; sample top 30 by index weight
    concept_sample: list[str] = []
    if not weights_df.empty and "stock_symbol" in weights_df.columns:
        w_col = next((c for c in weights_df.columns if c in ("weight", "weights")), None)
        if w_col is not None:
            latest_date = weights_df["date"].max()
            w_latest = weights_df[weights_df["date"] == latest_date].copy()
            w_latest[w_col] = pd.to_numeric(w_latest[w_col], errors="coerce")
            w_latest = w_latest.dropna(subset=[w_col])
            w_latest = w_latest[w_latest["stock_symbol"].astype(str).isin(set(universe))]
            concept_sample = (
                w_latest.sort_values(w_col, ascending=False)["stock_symbol"]
                .astype(str).head(30).tolist()
            )
    if not concept_sample:
        concept_sample = sorted(universe)[:30]
    concept_df = loader.load_concept_constituents(symbols=concept_sample)
    holders_df = loader.load_top_holders(universe, start_date=fetch_start, end_date=scan_date)

    exp_edges = explicit.build_all_explicit_edges(
        industry_df, concept_df, holders_df, universe,
        enable_concept=not concept_df.empty, enable_equity=not holders_df.empty,
    )
    imp_edges = implicit.build_all_implicit_edges(
        factor_df, universe, lookback=60,
        enable_dtw=graph_cfg.get("enable_dtw", True),
        enable_correlation=graph_cfg.get("enable_correlation", True),
        enable_granger=False,
    )
    mapper, adj, edge_summary = builder.build_full_graph(universe, exp_edges, imp_edges)
    print(f"[info] graph: {sum(edge_summary.values())} edges — {edge_summary}", file=sys.stderr)

    # ---- 3. Financial data ----
    lhb_near = loader.get_prev_trade_date(scan_date, n=5) or fetch_start
    fina_df = loader.load_fina_reports(universe, fetch_start, scan_date)
    lhb_df  = loader.load_lhb_list(lhb_near, scan_date)
    bt_df   = loader.load_block_trade(lhb_near, scan_date)

    # ---- 4. Features ----
    fbundle = feat_pipeline.build_features(
        factor_df=factor_df, post_df=post_df, index_df=index_df,
        fina_df=fina_df, share_float_df=float_df,
        lhb_df=lhb_df, block_trade_df=bt_df, industry_df=industry_df,
        adjacency=adj, symbols=universe, scan_date=scan_date,
        lookback=args.lookback, train_days=args.train_days,
    )
    print(f"[info] samples — train: {fbundle.train_x.shape[0]}, score: {fbundle.score_x.shape[0]}", file=sys.stderr)
    if fbundle.score_x.shape[0] == 0:
        # Auto-fallback: data not yet available for this date (e.g. today's data
        # hasn't landed), or date is a non-trading day. Step back 1 trading day.
        if args.date is None:
            prev = loader.get_prev_trade_date(scan_date, n=1)
            if prev:
                print(f"[warn] no eligible stocks on {scan_date}, retrying with {prev}", file=sys.stderr)
                args.date = prev
                return run_single_day(args)
        print("[error] no eligible stocks", file=sys.stderr); return 3

    tr_node_x  = _aggregate_to_nodes(fbundle.train_x, fbundle.train_symbols, mapper, method="mean")
    score_node_x = _aggregate_to_nodes(fbundle.score_x, fbundle.score_symbols, mapper, method="direct")
    targets = _build_targets(fbundle.train_symbols, fbundle.train_dates, factor_df, mapper)
    nz = int((np.abs(targets) > 1e-8).sum())
    print(f"[info] targets: {nz}/{mapper.n} non-zero", file=sys.stderr)

    # ---- 5. Train ----
    TRAIN_KEYS = {"batch_size", "epochs", "lr", "weight_decay", "val_frac",
                  "early_stop_patience", "grad_clip", "lookback", "seed", "input_dim"}
    model_params = {k: v for k, v in model_kwargs.items() if k not in TRAIN_KEYS}

    # Checkpoint: try to resume from saved model
    ckpt_path = REPO_ROOT / "models" / f"{model_name}_{scan_date}.pt"
    model = model_train._make_model(model_name, fbundle.n_features, args.lookback, **model_params)
    device = model_train._pick_device()
    if args.resume:
        ckpt_path = Path(args.resume)
        if ckpt_path.exists():
            meta_ckpt = model_train.load_checkpoint(model, ckpt_path, device=device)
            print(f"[info] resumed from {ckpt_path} (val_loss={meta_ckpt['val_loss']:.4f})", file=sys.stderr)
        else:
            print(f"[warn] --resume {args.resume} not found; training from scratch", file=sys.stderr)

    if not (args.resume and ckpt_path.exists()):
        result = model_train.train_model(
            tr_node_x, adj, mapper.symbols,
            targets=targets, node_symbols=mapper.symbols,
            model_name=model_name, input_dim=fbundle.n_features, lookback=args.lookback,
            batch_size=args.batch_size, epochs=args.epochs, seed=args.seed,
            **model_params,
        )
        model = result.model
        print(f"[info] {model_name} epochs={result.n_epochs_ran} train_loss={result.final_train_loss:.4f} val_loss={result.final_val_loss:.4f}", file=sys.stderr)

    # Save checkpoint
    if args.save_model:
        model_train.save_checkpoint(
            model, ckpt_path,
            model_name=model_name, input_dim=fbundle.n_features, lookback=args.lookback,
            val_loss=getattr(result, 'final_val_loss', float('nan')),
            seed=args.seed,
        )
        print(f"[info] saved checkpoint to {ckpt_path}", file=sys.stderr)

    # ---- 6. Score & Select ----
    scores_all = model_train.score_stocks(model, score_node_x, adj)
    score_map = dict(zip(mapper.symbols, scores_all))
    scores = np.array([score_map.get(s, 0.0) for s in fbundle.score_symbols])
    picks = stock_selector.select_top_k(scores, fbundle.score_symbols, top_k=args.top_k)

    # Enrich: sector, name, ret_T, market_cap
    if not industry_df.empty:
        sym_c = next((c for c in industry_df.columns if c in ("stock_symbol", "symbol")), None)
        ind_c = next((c for c in industry_df.columns if c == "l1_name"), None)
        if sym_c and ind_c:
            smap = dict(zip(industry_df[sym_c].astype(str), industry_df[ind_c].astype(str)))
            picks["sector"] = picks["symbol"].map(smap).fillna("—")
        else:
            picks["sector"] = "—"
    else:
        picks["sector"] = "—"

    post_T = post_df[post_df["date"] == scan_date][["symbol", "name"]].drop_duplicates()
    picks["name"] = picks["symbol"].map(dict(zip(post_T["symbol"], post_T["name"]))).fillna("")
    fT = factor_df[factor_df["date"] == scan_date][["symbol", "close", "market_cap"]].copy()
    fT["close"] = pd.to_numeric(fT["close"], errors="coerce")
    prev = factor_df[factor_df["date"] < scan_date].sort_values(["symbol", "date"]).groupby("symbol")["close"].last()
    fT["prev_close"] = fT["symbol"].map(prev)
    fT["ret_T"] = fT["close"] / fT["prev_close"] - 1.0
    picks["ret_T"] = picks["symbol"].map(dict(zip(fT["symbol"], fT["ret_T"])))
    picks["market_cap"] = picks["symbol"].map(dict(zip(fT["symbol"], fT["market_cap"])))
    picks["trade_date"] = scan_date

    # ---- 7. Risk ----
    risk = risk_monitor.market_risk_check(index_df)
    if risk["is_drawdown"]:
        print(f"[warn] drawdown: {risk['max_dd_20d']:.2%}", file=sys.stderr)

    # ---- 8. Write ----
    meta = {
        "index": args.index, "universe_size": len(universe),
        "score_size": len(fbundle.score_symbols),
        "train_start": min(fbundle.train_dates) if fbundle.train_dates else "?",
        "train_end": max(fbundle.train_dates) if fbundle.train_dates else "?",
        "train_days": args.train_days, "train_samples": fbundle.train_x.shape[0],
        "epochs_ran": result.n_epochs_ran, "val_loss": result.final_val_loss,
        "device": result.device, "graph_edges": sum(edge_summary.values()),
        "graph_summary": str(edge_summary),
        "score_mean": float(scores.mean()), "score_std": float(scores.std()),
        "score_max": float(scores.max()),
    }
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    csv_p = out / f"gnn_picks_{scan_date}.csv"
    md_p  = out / f"gnn_picks_{scan_date}.md"
    report.write_csv(picks, str(csv_p), top_n=args.top_k)
    report.write_markdown(picks, str(md_p), date=scan_date, top_k=args.top_k, model_name=model_name, meta=meta)
    print(f"[ok] {csv_p} ({min(args.top_k, len(picks))} rows)")
    print(f"[ok] {md_p}")
    return 0


def main() -> int:
    args = _parse_args()
    if args.backtest and args.start and args.end:
        return _run_backtest(args)
    return run_single_day(args)


def _run_backtest(args: argparse.Namespace) -> int:
    """Multi-day backtest: for each trading day in [start, end], run single-day
    scan, collect picks, then execute a daily-rebalance backtest and compute
    performance metrics."""
    print(f"[info] backtest mode: {args.start} → {args.end}", file=sys.stderr)

    # Auth before calendar lookup
    loader.init_panda_data()

    all_dates = cal_mod.trading_days_between(args.start, args.end)
    if not all_dates:
        print("[error] no trading days in range", file=sys.stderr)
        return 2

    picks_by_date: dict[str, pd.DataFrame] = {}
    total = len(all_dates)
    for i, date in enumerate(all_dates):
        print(f"[backtest] {date} ({i+1}/{total})", file=sys.stderr)
        args.date = date
        ret = run_single_day(args)
        if ret == 3:
            # No eligible stocks — likely data not yet available. Retry with
            # previous trading day; only if we have one and it hasn't been used.
            prev = loader.get_prev_trade_date(date, n=1)
            if prev and prev not in picks_by_date:
                print(f"[warn] no eligible stocks on {date}, retrying with {prev}", file=sys.stderr)
                args.date = prev
                ret = run_single_day(args)
        if ret != 0:
            print(f"[warn] skip {date} (error {ret})", file=sys.stderr)
            continue
        csv_path = Path(args.output_dir) / f"gnn_picks_{date}.csv"
        if csv_path.exists():
            picks_by_date[date] = pd.read_csv(csv_path)

    if not picks_by_date:
        print("[error] no valid pick days in backtest range", file=sys.stderr)
        return 2

    # Run backtest engine
    factor_df = loader.load_factor(args.start, args.end, args.index)
    cfg = bt_engine.BacktestConfig(
        start_date=args.start, end_date=args.end,
        initial_capital=1_000_000.0, top_k=args.top_k,
    )
    portfolio = bt_engine.run_backtest(picks_by_date, factor_df, cfg)

    nav_df = pd.DataFrame(portfolio.nav_history)
    trade_df = pd.DataFrame(portfolio.trade_history)
    metrics = bt_metrics.compute_metrics(nav_df)
    metrics["annual_turnover"] = bt_metrics.compute_turnover(trade_df)

    bt_path = Path(args.output_dir) / f"backtest_{args.start}_{args.end}.md"
    report.write_backtest_report(metrics, str(bt_path), date=args.end, model_name=args.model)
    print(f"[ok] backtest report: {bt_path}", file=sys.stderr)
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())


# ---------------------------------------------------------------------------
# Standard agent entry point
# ---------------------------------------------------------------------------
def run(
    date: str | None = None,
    model: str = "gats_ts",
    index: str = "000300.SH",
    lookback: int = 20,
    train_days: int = 252,
    top_k: int = 30,
    epochs: int = 100,
    batch_size: int = 64,
    seed: int = 42,
    resume: str | None = None,
    save_model: bool = True,
    output_dir: str | None = None,
    **kwargs,
) -> pd.DataFrame:
    """Standard entry point for external agents.

    Args:
        date:       scan date YYYYMMDD (None = latest trading day).
        model:      'gats_ts' or 'mf_iamgcn'.
        index:      index symbol (000300.SH / 000905.SH / 000852.SH).
        lookback:   feature window in trading days.
        train_days: training window in trading days.
        top_k:      number of stocks to select.
        epochs:     training epochs.
        batch_size: batch size.
        seed:       random seed.
        resume:     path to .pt checkpoint for warm-start.
        save_model: whether to persist trained model.
        output_dir: directory for output CSV/MD/checkpoints.
        **kwargs:   other model hyperparams (rnn_hidden, gat_heads, gcn_layers, ...).

    Returns:
        pd.DataFrame with columns [rank, symbol, name, score, ret_T, sector,
        market_cap, trade_date]. Also writes CSV + MD to output_dir.
    """
    if output_dir is None:
        output_dir = str(REPO_ROOT / "output")
    args = argparse.Namespace(
        date=date, model=model, index=index,
        lookback=lookback, train_days=train_days,
        top_k=top_k, epochs=epochs, batch_size=batch_size,
        seed=seed, backtest=False, resume=resume,
        save_model=save_model, output_dir=output_dir,
        config=str(REPO_ROOT / "config" / "model_config.yaml"),
        sentiment_file=None,
    )
    ret = run_single_day(args)
    if ret != 0:
        raise RuntimeError(f"GNN scan failed with exit code {ret}")

    csv_path = Path(output_dir) / f"gnn_picks_{date or 'latest'}.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)
    raise RuntimeError(f"Output not found: {csv_path}")
