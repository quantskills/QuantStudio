# -*- coding: utf-8 -*-
"""历史因子证据面板库：研究态追加 → 回测复用。

默认路径：data/panels/metrics_panel.parquet（旁路 CSV 便于检视）。
不改动依赖 Skill；由本 Agent 每次跑完 health_matrix 自动落库。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STORE = ROOT / "data" / "panels" / "metrics_panel.parquet"
DEFAULT_STORE_CSV = ROOT / "data" / "panels" / "metrics_panel.csv"

# 回测证据面板核心列（与 scripts/backtest.simulate_panels 对齐）
METRIC_COLS = [
    "date",
    "factor_id",
    "factor_name",
    "primary_score",
    "rank_ic",
    "pearson_ic",
    "ic_ir",
    "turnover",
    "half_life",
    "sign_reversal",
    "platform_ic",
    "crowding_level",
    "capital_consensus",
    "eval_ok",
    "decay_ok",
    "source_mode",
    "data_version",
    "simulated",
]


def ensure_store_dir(store: Path = DEFAULT_STORE) -> Path:
    store.parent.mkdir(parents=True, exist_ok=True)
    return store


def health_matrix_to_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """将单次 health_matrix 转为可入库的 metrics 行。"""
    if df is None or df.empty:
        return pd.DataFrame(columns=METRIC_COLS)

    out = df.copy()
    if "date" not in out.columns:
        if "as_of_date" in out.columns:
            out["date"] = out["as_of_date"]
        else:
            raise ValueError("health_matrix missing as_of_date/date")

    reasons = out["reasons"].astype(str) if "reasons" in out.columns else ""
    gaps = out["gap_notes"].astype(str) if "gap_notes" in out.columns else ""
    signal = out["signal"].astype(str) if "signal" in out.columns else ""

    if "sign_reversal" not in out.columns:
        out["sign_reversal"] = reasons.str.contains("SIGN_REVERSAL", na=False)
    if "platform_ic" not in out.columns:
        out["platform_ic"] = pd.NA
    if "turnover" not in out.columns:
        out["turnover"] = pd.NA
    if "eval_ok" not in out.columns:
        out["eval_ok"] = ~signal.eq("insufficient") & ~gaps.str.contains(
            "ScoreReport|score", case=False, na=False
        )
    if "decay_ok" not in out.columns:
        out["decay_ok"] = ~signal.eq("insufficient") & ~gaps.str.contains(
            "DecayReport|decay", case=False, na=False
        )
    if "simulated" not in out.columns:
        mode = out["source_mode"].astype(str) if "source_mode" in out.columns else ""
        out["simulated"] = mode.eq("mock")
    if "factor_name" not in out.columns:
        out["factor_name"] = out["factor_id"]

    for col in METRIC_COLS:
        if col not in out.columns:
            out[col] = pd.NA

    out = out[METRIC_COLS].copy()
    out["date"] = pd.to_datetime(out["date"]).dt.strftime("%Y-%m-%d")
    out["factor_id"] = out["factor_id"].astype(str)
    return out


def load_metrics(store: Union[str, Path] = DEFAULT_STORE) -> pd.DataFrame:
    path = Path(store)
    if not path.is_absolute():
        path = ROOT / path
    if not path.exists():
        csv = path.with_suffix(".csv")
        if csv.exists():
            path = csv
        else:
            return pd.DataFrame(columns=METRIC_COLS)
    if path.suffix.lower() in {".parquet", ".pq"}:
        try:
            df = pd.read_parquet(path)
        except Exception:
            csv = path.with_suffix(".csv")
            if csv.exists():
                df = pd.read_csv(csv)
            else:
                raise
    else:
        df = pd.read_csv(path)
    if df.empty:
        return pd.DataFrame(columns=METRIC_COLS)
    if "date" not in df.columns and "as_of_date" in df.columns:
        df = df.rename(columns={"as_of_date": "date"})
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df["factor_id"] = df["factor_id"].astype(str)
    return df


def _store_path(store: Union[str, Path] = DEFAULT_STORE) -> Path:
    path = Path(store)
    if not path.is_absolute():
        path = ROOT / path
    return path


def _portable(path: Union[str, Path]) -> str:
    from runtime.paths import portable_ref

    p = Path(path)
    try:
        return p.resolve().relative_to(ROOT.resolve()).as_posix()
    except Exception:
        return portable_ref(p)


def save_metrics(df: pd.DataFrame, store: Union[str, Path] = DEFAULT_STORE) -> Path:
    path = ensure_store_dir(_store_path(store))
    out = df.reindex(columns=METRIC_COLS).copy() if not df.empty else pd.DataFrame(columns=METRIC_COLS)
    if not out.empty:
        out = out.drop_duplicates(subset=["date", "factor_id"], keep="last")
        out = out.sort_values(["date", "factor_id"]).reset_index(drop=True)
    try:
        out.to_parquet(path, index=False)
    except Exception:
        # parquet 引擎缺失时仍保 CSV
        pass
    csv_path = path.with_suffix(".csv")
    out.to_csv(csv_path, index=False, encoding="utf-8-sig")
    return path


def upsert_metrics(
    rows: pd.DataFrame, store: Union[str, Path] = DEFAULT_STORE
) -> Dict[str, Any]:
    """按 (date, factor_id) 幂等合并。"""
    incoming = (
        health_matrix_to_metrics(rows)
        if "as_of_date" in rows.columns and "date" not in rows.columns
        else rows
    )
    if "date" not in incoming.columns:
        incoming = health_matrix_to_metrics(rows)
    incoming = incoming.reindex(columns=METRIC_COLS).copy()
    existing = load_metrics(store).reindex(columns=METRIC_COLS)

    def _normalize(df: pd.DataFrame) -> pd.DataFrame:
        if df is None or df.empty:
            return df
        out = df.copy()
        for c in (
            "primary_score",
            "rank_ic",
            "pearson_ic",
            "ic_ir",
            "turnover",
            "half_life",
            "platform_ic",
        ):
            out[c] = pd.to_numeric(out[c], errors="coerce")
        for c in ("sign_reversal", "eval_ok", "decay_ok", "simulated"):
            out[c] = out[c].astype("boolean")
        for c in (
            "date",
            "factor_id",
            "factor_name",
            "crowding_level",
            "capital_consensus",
            "source_mode",
            "data_version",
        ):
            out[c] = out[c].astype("string")
        return out

    incoming = _normalize(incoming)
    existing = _normalize(existing)
    frames = [f for f in (existing, incoming) if f is not None and not f.empty]
    merged = (
        pd.concat(frames, ignore_index=True)
        if frames
        else pd.DataFrame(columns=METRIC_COLS)
    )
    path = save_metrics(merged, store)
    n_dates = int(merged["date"].nunique()) if not merged.empty else 0
    return {
        "store": _portable(path),
        "n_rows": int(len(merged)),
        "n_dates": n_dates,
        "n_appended": int(len(incoming)),
    }


def append_from_run(
    run_dir: Union[str, Path],
    store: Union[str, Path] = DEFAULT_STORE,
) -> Dict[str, Any]:
    """从一次研究态产物追加 health_matrix。

    调用方应仅在 live/degraded 下调用（见 runtime/graph.py）。
    """
    rd = Path(run_dir)
    if not rd.is_absolute():
        rd = ROOT / rd
    mat = rd / "health_matrix.csv"
    if not mat.exists():
        return {"ok": False, "error": f"missing {_portable(mat)}", "n_appended": 0}
    df = pd.read_csv(mat)
    stats = upsert_metrics(df, store=store)
    stats["ok"] = True
    stats["run_dir"] = _portable(rd)
    return stats


def build_fwd_from_metrics(
    metrics: pd.DataFrame, *, horizon: int = 20
) -> Tuple[pd.DataFrame, str]:
    """用下一期 rank_ic 近似后验；标注 approx。"""
    if metrics is None or metrics.empty:
        return pd.DataFrame(
            columns=["date", "factor_id", "fwd_ic", "fwd_ret", "horizon", "fwd_source"]
        ), "empty"
    m = metrics.sort_values(["factor_id", "date"]).copy()
    m["fwd_ic"] = m.groupby("factor_id")["rank_ic"].shift(-1)
    m["fwd_ret"] = m["fwd_ic"] * 0.5
    m["horizon"] = horizon
    m["fwd_source"] = "next_rank_ic_approx"
    fwd = m[["date", "factor_id", "fwd_ic", "fwd_ret", "horizon", "fwd_source"]].dropna(
        subset=["fwd_ic"]
    )
    return fwd, "next_rank_ic_approx"


def store_coverage(store: Union[str, Path] = DEFAULT_STORE) -> Dict[str, Any]:
    df = load_metrics(store)
    if df.empty:
        return {"n_rows": 0, "n_dates": 0, "n_factors": 0, "ok_for_backtest": False}
    n_dates = int(df["date"].nunique())
    return {
        "n_rows": int(len(df)),
        "n_dates": n_dates,
        "n_factors": int(df["factor_id"].nunique()),
        "min_date": str(df["date"].min()),
        "max_date": str(df["date"].max()),
        "ok_for_backtest": n_dates >= 2,
    }


def resolve_for_backtest(
    *,
    store: Union[str, Path] = DEFAULT_STORE,
    start_date: str,
    end_date: str,
    horizon: int = 20,
    min_dates: int = 2,
) -> Dict[str, Any]:
    """供 backtest --from-panel-store 使用（账本仅由 live/degraded 写入）。"""
    metrics = load_metrics(store)
    if metrics.empty:
        return {"ok": False, "error": "panel store empty", "metrics": metrics, "fwd": None}
    metrics = metrics[
        (metrics["date"] >= start_date) & (metrics["date"] <= end_date)
    ].copy()
    cov = {
        "n_rows": int(len(metrics)),
        "n_dates": int(metrics["date"].nunique()) if not metrics.empty else 0,
    }
    if cov["n_dates"] < min_dates:
        return {
            "ok": False,
            "error": (
                f"panel store has {cov['n_dates']} dates in range "
                f"(need >={min_dates}); keep running research mode to accumulate"
            ),
            "metrics": metrics,
            "fwd": None,
            "coverage": cov,
        }
    fwd, fwd_source = build_fwd_from_metrics(metrics, horizon=horizon)
    if fwd.empty:
        return {
            "ok": False,
            "error": "could not build fwd panel from store (need >=2 dates per factor)",
            "metrics": metrics,
            "fwd": fwd,
            "coverage": cov,
        }
    return {
        "ok": True,
        "metrics": metrics,
        "fwd": fwd,
        "fwd_source": fwd_source,
        "coverage": cov,
        "store": _portable(store),
    }
