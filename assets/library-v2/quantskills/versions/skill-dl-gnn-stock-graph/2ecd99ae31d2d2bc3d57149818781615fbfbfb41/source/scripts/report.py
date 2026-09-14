"""Report emitters for GNN stock selection results.

Outputs:
  - CSV: top-K picks with metadata (score, sector, market_cap)
  - Markdown: human-readable report with model diagnostics
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

HITS_COLUMNS: list[str] = [
    "trade_date",
    "rank",
    "symbol",
    "name",
    "score",
    "ret_T",
    "sector",
    "market_cap",
]


def _order_and_rank(hits_df: pd.DataFrame, top_n: int) -> pd.DataFrame:
    """Sort by score descending, truncate to top_n, assign rank."""
    if hits_df.empty:
        return hits_df.assign(rank=[]) if "rank" not in hits_df.columns else hits_df
    df = hits_df.sort_values("score", ascending=False).head(top_n).copy()
    df["rank"] = range(1, len(df) + 1)
    return df.reset_index(drop=True)


def write_csv(hits_df: pd.DataFrame, path: str, top_n: int) -> None:
    """Write top-K picks to CSV."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df = _order_and_rank(hits_df, top_n)
    for c in HITS_COLUMNS:
        if c not in df.columns:
            df[c] = None
    df[HITS_COLUMNS].to_csv(path, index=False)


def write_markdown(
    hits_df: pd.DataFrame,
    path: str,
    *,
    date: str,
    top_k: int,
    model_name: str,
    meta: dict,
) -> None:
    """Write human-readable Markdown report.

    Args:
        hits_df: picks DataFrame.
        path: output markdown path.
        date: scan date YYYYMMDD.
        top_k: number of picks shown.
        model_name: 'gats_ts' or 'mf_iamgcn'.
        meta: dict with keys: index, universe_size, score_size, train_start, train_end,
              train_days, train_samples, epochs_ran, val_loss, device, graph_edges.
    """
    df = _order_and_rank(hits_df, top_k)

    lines: list[str] = []
    lines.append(f"# GNN 选股榜单 · {date}\n")
    lines.append(f"- **模型**: {model_name}")
    lines.append(
        f"- **股票池**: {meta.get('index', '000300.SH')} "
        f"（{meta.get('universe_size', '?')} 只成分股，{meta.get('score_size', '?')} 只参与打分）"
    )
    lines.append(
        f"- **训练窗口**: {meta.get('train_start', '?')} → {meta.get('train_end', '?')} "
        f"（{meta.get('train_days', '?')} 交易日，{meta.get('train_samples', '?')} 样本）"
    )
    lines.append(
        f"- **图结构**: {meta.get('graph_edges', '?')} 条边 "
        f"（{meta.get('graph_summary', '')}）"
    )
    lines.append(
        f"- **训练**: {meta.get('epochs_ran', '?')} epochs，"
        f"验证 MSE {meta.get('val_loss', float('nan')):.4f}，"
        f"设备 {meta.get('device', 'cpu')}"
    )
    lines.append(
        f"- **得分分布**: mean={meta.get('score_mean', float('nan')):.4f}, "
        f"std={meta.get('score_std', float('nan')):.4f}, "
        f"max={meta.get('score_max', float('nan')):.4f}\n"
    )

    if df.empty:
        lines.append("\n_今日无有效打分样本。_\n")
    else:
        lines.append(f"## Top {len(df)} 选股\n")
        lines.append("| Rank | Symbol | Name | Score | 收益T | 行业 | 市值(亿) |")
        lines.append("|------|--------|------|-------|-------|------|----------|")
        for _, row in df.iterrows():
            name = row.get("name", "") or ""
            ret_t = row.get("ret_T", float("nan"))
            ret_str = f"{ret_t:+.4f}" if not pd.isna(ret_t) else "—"
            sector = row.get("sector", "") or "—"
            mcap = row.get("market_cap", float("nan"))
            mcap_str = f"{mcap / 1e8:.1f}" if not pd.isna(mcap) else "—"
            lines.append(
                f"| {int(row['rank'])} | {row['symbol']} | {name} | "
                f"{row['score']:.4f} | {ret_str} | {sector} | {mcap_str} |"
            )

        # Sector distribution
        if "sector" in df.columns:
            sector_counts = df["sector"].value_counts().head(5)
            parts = [f"{s}（{c}）" for s, c in sector_counts.items()]
            lines.append(f"\n---\n\n_行业分布: {', '.join(parts)}。_\n")

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("\n".join(lines), encoding="utf-8")


def write_backtest_report(
    metrics: dict,
    path: str,
    *,
    date: str,
    model_name: str,
) -> None:
    """Write backtest performance report."""
    lines: list[str] = []
    lines.append(f"# 回测绩效报告\n")
    lines.append(f"- **日期**: {date}")
    lines.append(f"- **模型**: {model_name}\n")
    lines.append("## 绩效指标\n")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    metric_labels = {
        "annual_return": "年化收益率",
        "annual_volatility": "年化波动率",
        "max_drawdown": "最大回撤",
        "sharpe_ratio": "夏普比率",
        "sortino_ratio": "索提诺比率",
        "calmar_ratio": "卡玛比率",
        "information_ratio": "信息比率",
        "excess_return": "超额收益",
        "win_rate": "胜率",
        "total_return": "累计收益",
    }
    for key, label in metric_labels.items():
        value = metrics.get(key, float("nan"))
        if key in ("win_rate", "annual_return", "annual_volatility",
                    "max_drawdown", "excess_return", "total_return"):
            lines.append(f"| {label} | {value:.2%} |")
        else:
            lines.append(f"| {label} | {value:.2f} |")

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("\n".join(lines), encoding="utf-8")
