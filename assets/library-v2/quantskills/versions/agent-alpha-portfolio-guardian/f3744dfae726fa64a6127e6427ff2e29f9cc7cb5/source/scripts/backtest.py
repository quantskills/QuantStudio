# -*- coding: utf-8 -*-
"""守卫信号有效性回测（分析型最低集，非 Alpha 生产 IC 回测）。

在历史再平衡日对因子证据跑规则引擎，用后续窗口表现检验：
  - 各 signal 分桶的后续 IC / 代理收益
  - retire/deweight 事后走弱准确率
  - keep 组合代理净值最大回撤
  - 滚动窗样本外表现

用法：
  python scripts/backtest.py --allow-simulate --start_date 2024-01-01 --end_date 2025-12-31
  python scripts/backtest.py --metrics-panel path.csv --fwd-panel path.csv
  python -m runtime backtest --from-panel-store
  python -m runtime backtest --allow-simulate
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT), str(ROOT / "scripts")]

from runtime.rules import FactorEvidence, decide_factor  # noqa: E402


DISCLAIMER = (
    "本回测仅检验守卫规则的历史统计特征，不构成投资建议。"
)


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Guardian signal effectiveness backtest")
    p.add_argument("--start_date", default="2024-01-01")
    p.add_argument("--end_date", default=datetime.today().strftime("%Y-%m-%d"))
    p.add_argument("--rebalance-days", type=int, default=20, help="再平衡间隔（交易日近似用日历步长）")
    p.add_argument("--horizon", type=int, default=20, help="信号后验窗口（日）")
    p.add_argument("--metrics-panel", default="", help="历史因子证据面板 CSV/Parquet")
    p.add_argument("--fwd-panel", default="", help="后验表现面板 CSV/Parquet（可选，缺则由 metrics 推导）")
    p.add_argument(
        "--from-panel-store",
        action="store_true",
        help="从 data/panels/metrics_panel.* 读取（研究态自动累积）",
    )
    p.add_argument(
        "--panel-store",
        default="",
        help="自定义 panel store 路径（默认 data/panels/metrics_panel.parquet）",
    )
    p.add_argument("--portfolio", default="config/portfolio.mock.yaml")
    p.add_argument("--output-dir", default="reports/backtest")
    p.add_argument(
        "--allow-simulate",
        action="store_true",
        help="无面板时生成模拟数据（仅研究自测）",
    )
    p.add_argument("--rules-version", default="")
    return p.parse_args(argv)


def _load_table(path: str) -> pd.DataFrame:
    p = Path(path)
    if not p.is_absolute():
        p = ROOT / p
    if not p.exists():
        raise FileNotFoundError(p)
    if p.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(p)
    return pd.read_csv(p)


def _load_thresholds(portfolio: str) -> Tuple[Dict[str, Any], str]:
    from runtime.config_loader import load_portfolio

    cfg = load_portfolio(portfolio)
    return dict(cfg.get("thresholds") or {}), str(cfg.get("rules_version") or "guardian-rules-v0.1")


def simulate_panels(
    start: str,
    end: str,
    rebalance_days: int,
    horizon: int,
    factor_ids: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """生成可复现的模拟证据与后验面板（标注 simulated）。"""
    rng = np.random.default_rng(42)
    dates = pd.bdate_range(start, end, freq=f"{max(rebalance_days, 1)}B")
    factors = factor_ids or ["F001", "F002", "F003"]
    # 因子固有质量：F001 中等，F002 稳健，F003 易失效
    quality = {"F001": 0.02, "F002": 0.035, "F003": 0.005}
    rows_m = []
    rows_f = []
    for d in dates:
        for fid in factors:
            q = quality.get(fid, 0.02)
            drift = float(rng.normal(0, 0.01))
            rank_ic = q + drift
            primary = float(np.clip(rank_ic * 20 + rng.normal(0, 0.15), -1.0, 1.2))
            if fid == "F003":
                half_life = float(rng.uniform(0.8, 2.5))
                turnover = float(rng.uniform(0.55, 0.85))
                sign_rev = bool(rng.random() < 0.35)
            elif fid == "F002":
                half_life = float(rng.uniform(8, 18))
                turnover = float(rng.uniform(0.2, 0.4))
                sign_rev = False
            else:
                half_life = float(rng.uniform(3, 10))
                turnover = float(rng.uniform(0.3, 0.55))
                sign_rev = False
            rows_m.append(
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "factor_id": fid,
                    "factor_name": fid,
                    "primary_score": round(primary, 4),
                    "rank_ic": round(rank_ic, 5),
                    "pearson_ic": round(rank_ic * 0.8, 5),
                    "ic_ir": round(abs(rank_ic) * 40, 3),
                    "turnover": round(turnover, 4),
                    "half_life": round(half_life, 3),
                    "sign_reversal": sign_rev,
                    "platform_ic": round(max(rank_ic * 0.3, 0.0), 5),
                    "crowding_level": "info",
                    "capital_consensus": "aligned" if fid != "F003" else "divergent",
                    "eval_ok": True,
                    "decay_ok": True,
                    "simulated": True,
                }
            )
            # 后验：质量差的因子后续 IC 更容易走弱
            shock = float(rng.normal(0, 0.008))
            if fid == "F003":
                fwd_ic = rank_ic * 0.2 + shock - 0.01
            else:
                fwd_ic = rank_ic * 0.85 + shock
            fwd_ret = fwd_ic * 0.5  # 代理收益
            rows_f.append(
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "factor_id": fid,
                    "horizon": horizon,
                    "fwd_ic": round(fwd_ic, 5),
                    "fwd_ret": round(fwd_ret, 5),
                    "simulated": True,
                }
            )
    return pd.DataFrame(rows_m), pd.DataFrame(rows_f)


def _row_to_evidence(row: pd.Series) -> FactorEvidence:
    return FactorEvidence(
        factor_id=str(row["factor_id"]),
        factor_name=str(row.get("factor_name") or row["factor_id"]),
        primary_score=_num(row.get("primary_score")),
        rank_ic=_num(row.get("rank_ic")),
        pearson_ic=_num(row.get("pearson_ic")),
        ic_ir=_num(row.get("ic_ir")),
        turnover=_num(row.get("turnover")),
        half_life=_num(row.get("half_life")),
        sign_reversal=bool(row.get("sign_reversal")),
        platform_ic=_num(row.get("platform_ic")),
        crowding_level=str(row.get("crowding_level") or "info"),
        capital_consensus=str(row.get("capital_consensus") or "no_data"),
        eval_ok=bool(row.get("eval_ok", True)),
        decay_ok=bool(row.get("decay_ok", True)),
        ic_by_horizon={
            1: float(row["rank_ic"]) if pd.notna(row.get("rank_ic")) else 0.0,
            20: float(row["platform_ic"])
            if pd.notna(row.get("platform_ic"))
            else (float(row["rank_ic"]) * 0.3 if pd.notna(row.get("rank_ic")) else 0.0),
        },
    )


def _num(x: Any) -> Optional[float]:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    try:
        if pd.isna(x):
            return None
    except Exception:
        pass
    return float(x)


def run_signals(metrics: pd.DataFrame, thresholds: Dict[str, Any]) -> pd.DataFrame:
    records = []
    for _, row in metrics.iterrows():
        ev = _row_to_evidence(row)
        dec = decide_factor(ev, thresholds)
        records.append(
            {
                "date": row["date"],
                "factor_id": row["factor_id"],
                "signal": dec.signal,
                "health_status": dec.health_status,
                "reasons": "|".join(dec.reasons),
                "confidence": dec.confidence,
                "primary_score": ev.primary_score,
                "rank_ic": ev.rank_ic,
                "half_life": ev.half_life,
            }
        )
    return pd.DataFrame(records)


def attach_forward(signals: pd.DataFrame, fwd: pd.DataFrame) -> pd.DataFrame:
    cols = ["date", "factor_id", "fwd_ic", "fwd_ret", "horizon"]
    use = [c for c in cols if c in fwd.columns]
    merged = signals.merge(fwd[use], on=["date", "factor_id"], how="left")
    return merged


def bucket_stats(panel: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for sig, g in panel.groupby("signal"):
        rows.append(
            {
                "signal": sig,
                "n": int(len(g)),
                "mean_fwd_ic": float(g["fwd_ic"].mean()) if "fwd_ic" in g else np.nan,
                "mean_fwd_ret": float(g["fwd_ret"].mean()) if "fwd_ret" in g else np.nan,
                "std_fwd_ret": float(g["fwd_ret"].std()) if "fwd_ret" in g else np.nan,
                "mean_rank_ic_at_signal": float(g["rank_ic"].mean())
                if "rank_ic" in g
                else np.nan,
            }
        )
    return pd.DataFrame(rows).sort_values("signal")


def accuracy_stats(panel: pd.DataFrame) -> Dict[str, Any]:
    """描述性准确率定义写清。"""
    out: Dict[str, Any] = {"definitions": {}}
    keep = panel[panel["signal"] == "keep"]
    avoid = panel[panel["signal"].isin(["retire_candidate", "deweight", "rebuild_candidate"])]

    keep_fwd = keep["fwd_ic"].dropna()
    avoid_fwd = avoid["fwd_ic"].dropna()
    keep_mean = float(keep_fwd.mean()) if len(keep_fwd) else np.nan
    avoid_mean = float(avoid_fwd.mean()) if len(avoid_fwd) else np.nan

    # retire/deweight/rebuild 后 fwd_ic 低于 keep 组均值 → 计为「走弱命中」
    if len(avoid_fwd) and np.isfinite(keep_mean):
        hit = (avoid_fwd < keep_mean).mean()
        out["avoid_weaker_than_keep_rate"] = float(hit)
    else:
        out["avoid_weaker_than_keep_rate"] = np.nan
    out["definitions"]["avoid_weaker_than_keep_rate"] = (
        "signal∈{retire_candidate,deweight,rebuild_candidate} 且后续 fwd_ic < keep 组均值 的占比"
    )

    retire = panel[panel["signal"] == "retire_candidate"]["fwd_ic"].dropna()
    if len(retire):
        out["retire_negative_fwd_ic_rate"] = float((retire < 0).mean())
    else:
        out["retire_negative_fwd_ic_rate"] = np.nan
    out["definitions"]["retire_negative_fwd_ic_rate"] = (
        "retire_candidate 信号后 fwd_ic < 0 的占比"
    )

    out["keep_mean_fwd_ic"] = keep_mean
    out["avoid_mean_fwd_ic"] = avoid_mean
    out["keep_minus_avoid_fwd_ic"] = (
        keep_mean - avoid_mean
        if np.isfinite(keep_mean) and np.isfinite(avoid_mean)
        else np.nan
    )
    return out


def keep_portfolio_path(panel: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, float]]:
    """按日等权 keep 因子的 fwd_ret 合成代理组合，算 MDD。"""
    keep = panel[panel["signal"] == "keep"].copy()
    if keep.empty or "fwd_ret" not in keep.columns:
        return pd.DataFrame(), {"max_drawdown": np.nan, "ann_like_return": np.nan, "n_dates": 0}

    daily = keep.groupby("date", as_index=False)["fwd_ret"].mean().sort_values("date")
    daily["equity"] = (1.0 + daily["fwd_ret"].fillna(0.0)).cumprod()
    peak = daily["equity"].cummax()
    dd = daily["equity"] / peak - 1.0
    daily["drawdown"] = dd
    mdd = float(dd.min()) if len(dd) else np.nan
    total = float(daily["equity"].iloc[-1] - 1.0) if len(daily) else np.nan
    return daily, {
        "max_drawdown": mdd,
        "cum_return": total,
        "n_dates": int(len(daily)),
    }


def rolling_oos(panel: pd.DataFrame, n_folds: int = 3) -> pd.DataFrame:
    dates = sorted(panel["date"].unique())
    if len(dates) < n_folds * 2:
        n_folds = max(1, len(dates) // 3) or 1
    folds = np.array_split(dates, n_folds)
    rows = []
    for i, fold_dates in enumerate(folds):
        g = panel[panel["date"].isin(fold_dates)]
        acc = accuracy_stats(g)
        rows.append(
            {
                "fold": i + 1,
                "start": fold_dates[0] if len(fold_dates) else "",
                "end": fold_dates[-1] if len(fold_dates) else "",
                "n": int(len(g)),
                "keep_mean_fwd_ic": acc.get("keep_mean_fwd_ic"),
                "avoid_mean_fwd_ic": acc.get("avoid_mean_fwd_ic"),
                "avoid_weaker_than_keep_rate": acc.get("avoid_weaker_than_keep_rate"),
                "retire_negative_fwd_ic_rate": acc.get("retire_negative_fwd_ic_rate"),
            }
        )
    return pd.DataFrame(rows)


def write_report(
    out_dir: Path,
    *,
    meta: Dict[str, Any],
    buckets: pd.DataFrame,
    accuracy: Dict[str, Any],
    port_stats: Dict[str, float],
    rolling: pd.DataFrame,
) -> Path:
    defs = "\n".join(
        f"- `{k}`: {v}" for k, v in (accuracy.get("definitions") or {}).items()
    )
    text = "\n".join(
        [
            "# 守卫信号有效性回测报告",
            "",
            "## 样本与规则",
            "",
            f"- 样本区间: `{meta['start_date']}` → `{meta['end_date']}`",
            f"- 再平衡间隔: `{meta['rebalance_days']}` 日",
            f"- 后验窗口 horizon: `{meta['horizon']}` 日",
            f"- rules_version: `{meta['rules_version']}`",
            f"- data_version: `{meta['data_version']}`",
            f"- source_mode: `{meta['source_mode']}`",
            f"- n_signal_rows: `{meta['n_rows']}`",
            "",
            "## 分桶表现",
            "",
            "```",
            buckets.to_string(index=False),
            "```",
            "",
            "## 描述性准确率",
            "",
            f"- keep 组 mean fwd_ic: `{accuracy.get('keep_mean_fwd_ic')}`",
            f"- avoid 组 mean fwd_ic: `{accuracy.get('avoid_mean_fwd_ic')}`",
            f"- keep − avoid fwd_ic: `{accuracy.get('keep_minus_avoid_fwd_ic')}`",
            f"- avoid 弱于 keep 占比: `{accuracy.get('avoid_weaker_than_keep_rate')}`",
            f"- retire 后 fwd_ic<0 占比: `{accuracy.get('retire_negative_fwd_ic_rate')}`",
            "",
            "定义:",
            "",
            defs,
            "",
            "## keep 组合代理路径风险",
            "",
            f"- max_drawdown: `{port_stats.get('max_drawdown')}`",
            f"- cum_return: `{port_stats.get('cum_return')}`",
            f"- n_dates: `{port_stats.get('n_dates')}`",
            "",
            "## 滚动窗样本外",
            "",
            "```",
            rolling.to_string(index=False),
            "```",
            "",
            "## 免责声明",
            "",
            DISCLAIMER,
            "",
        ]
    )
    path = out_dir / "backtest_report.md"
    path.write_text(text, encoding="utf-8")
    return path


def run_backtest(args: argparse.Namespace) -> Dict[str, Any]:
    thresholds, rules_version = _load_thresholds(args.portfolio)
    if args.rules_version:
        rules_version = args.rules_version

    simulated = False
    fwd_source = None
    panel_store_meta: Dict[str, Any] = {}
    from_store = bool(getattr(args, "from_panel_store", False))

    if args.metrics_panel:
        metrics = _load_table(args.metrics_panel)
        if args.fwd_panel:
            fwd = _load_table(args.fwd_panel)
            fwd_source = "user_fwd_panel"
        else:
            from runtime.panel_store import build_fwd_from_metrics

            fwd, fwd_source = build_fwd_from_metrics(metrics, horizon=args.horizon)
        source_mode = "live"
        data_version = f"guardian-bt-v0.1+{rules_version}"
    elif from_store:
        from runtime.panel_store import DEFAULT_STORE, resolve_for_backtest

        store = getattr(args, "panel_store", "") or str(DEFAULT_STORE)
        resolved = resolve_for_backtest(
            store=store,
            start_date=args.start_date,
            end_date=args.end_date,
            horizon=args.horizon,
        )
        panel_store_meta = {
            k: resolved.get(k)
            for k in ("store", "coverage", "fwd_source", "error")
            if k in resolved
        }
        if not resolved.get("ok"):
            if args.allow_simulate:
                print(f"[WARN] panel store unavailable ({resolved.get('error')}); fallback simulate")
                metrics, fwd = simulate_panels(
                    args.start_date, args.end_date, args.rebalance_days, args.horizon
                )
                simulated = True
                source_mode = "mock"
                data_version = f"guardian-bt-mock-v0.1+{rules_version}"
                fwd_source = "simulate"
            else:
                raise SystemExit(
                    "panel store not ready: "
                    f"{resolved.get('error')}; "
                    "keep running research mode, or pass --allow-simulate / --metrics-panel"
                )
        else:
            metrics = resolved["metrics"]
            fwd = resolved["fwd"]
            fwd_source = resolved.get("fwd_source")
            # store 含 mock 行则整体标 mock，避免假 live
            sim_col = (
                metrics["simulated"].fillna(False)
                if "simulated" in metrics.columns
                else pd.Series(False, index=metrics.index)
            )
            if bool(sim_col.any()):
                source_mode = "mock"
                data_version = f"guardian-bt-store-mock-v0.1+{rules_version}"
            else:
                source_mode = "live"
                data_version = f"guardian-bt-store-v0.1+{rules_version}"
    elif args.allow_simulate:
        metrics, fwd = simulate_panels(
            args.start_date, args.end_date, args.rebalance_days, args.horizon
        )
        simulated = True
        source_mode = "mock"
        data_version = f"guardian-bt-mock-v0.1+{rules_version}"
        fwd_source = "simulate"
    else:
        raise SystemExit(
            "need --from-panel-store or --metrics-panel or --allow-simulate "
            "(no silent simulation)"
        )

    metrics["date"] = pd.to_datetime(metrics["date"]).dt.strftime("%Y-%m-%d")
    fwd["date"] = pd.to_datetime(fwd["date"]).dt.strftime("%Y-%m-%d")
    metrics = metrics[
        (metrics["date"] >= args.start_date) & (metrics["date"] <= args.end_date)
    ]

    signals = run_signals(metrics, thresholds)
    panel = attach_forward(signals, fwd).dropna(subset=["fwd_ic"], how="any")
    buckets = bucket_stats(panel)
    accuracy = accuracy_stats(panel)
    equity, port_stats = keep_portfolio_path(panel)
    rolling = rolling_oos(panel, n_folds=3)

    out_dir = Path(args.output_dir)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = out_dir / stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    from runtime.paths import portable_ref

    meta = {
        "start_date": args.start_date,
        "end_date": args.end_date,
        "rebalance_days": args.rebalance_days,
        "horizon": args.horizon,
        "rules_version": rules_version,
        "data_version": data_version,
        "source_mode": source_mode,
        "simulated": simulated,
        "fwd_source": fwd_source,
        "panel_store": panel_store_meta or None,
        "n_rows": int(len(panel)),
        "portfolio": portable_ref(args.portfolio),
    }

    panel.to_csv(run_dir / "signal_forward_panel.csv", index=False, encoding="utf-8-sig")
    buckets.to_csv(run_dir / "bucket_stats.csv", index=False, encoding="utf-8-sig")
    rolling.to_csv(run_dir / "rolling_oos.csv", index=False, encoding="utf-8-sig")
    if not equity.empty:
        equity.to_csv(run_dir / "keep_equity.csv", index=False, encoding="utf-8-sig")
    (run_dir / "accuracy.json").write_text(
        json.dumps(accuracy, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (run_dir / "summary.json").write_text(
        json.dumps(
            {"meta": meta, "portfolio_stats": port_stats, "accuracy": accuracy},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    report = write_report(
        run_dir,
        meta=meta,
        buckets=buckets,
        accuracy=accuracy,
        port_stats=port_stats,
        rolling=rolling,
    )

    l4_html = ""
    try:
        from export_l4_backtest import export_l4_backtest

        l4_paths = export_l4_backtest(run_dir)
        l4_html = l4_paths.get("l4_html", "")
    except Exception as exc:  # noqa: BLE001 — 图表失败不阻断回测主产物
        print(f"[WARN] L4 HTML export skipped: {exc}")

    # 也写一份 latest 指针方便 CLI
    latest = out_dir / "latest"
    if latest.exists() or latest.is_symlink():
        if latest.is_dir() and not latest.is_symlink():
            import shutil

            shutil.rmtree(latest)
        else:
            latest.unlink()
    try:
        latest.symlink_to(run_dir.name, target_is_directory=True)
    except Exception:
        # Windows 无权限时复制摘要
        import shutil

        if latest.exists():
            shutil.rmtree(latest)
        shutil.copytree(run_dir, latest)

    return {
        "run_dir": str(run_dir),
        "report": str(report),
        "l4_html": l4_html,
        "meta": meta,
        "portfolio_stats": port_stats,
        "accuracy": accuracy,
    }


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)
    result = run_backtest(args)
    print(f"[OK] backtest → {result['run_dir']}")
    print(f"[OK] report → {result['report']}")
    if result.get("l4_html"):
        print(f"[OK] l4 → {result['l4_html']}")
    acc = result["accuracy"]
    print(
        "[OK] keep-avoid spread="
        f"{acc.get('keep_minus_avoid_fwd_ic')} "
        f"avoid_weaker_rate={acc.get('avoid_weaker_than_keep_rate')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
