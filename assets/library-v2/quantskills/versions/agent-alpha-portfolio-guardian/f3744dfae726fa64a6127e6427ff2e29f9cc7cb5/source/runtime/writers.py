# -*- coding: utf-8 -*-
"""研究态报告包写出。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd

from runtime.paths import pack_rel, portable_ref

DISCLAIMER = (
    "本报告基于公开数据与规则化分析生成，仅供量化研究参考，不构成任何投资建议。"
)

FORBIDDEN = ("买入", "卖出", "必涨", "仓位提到")


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: Sequence[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(list(rows))
    df.to_csv(path, index=False, encoding="utf-8-sig")


def try_write_parquet(path: Path, rows: Sequence[Dict[str, Any]]) -> bool:
    try:
        df = pd.DataFrame(list(rows))
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(path, index=False)
        return True
    except Exception:
        return False


def ascii_ic_decay(curves: Dict[str, List[Dict[str, Any]]], width: int = 40) -> str:
    lines = ["IC Decay (ASCII)", "horizon → IC_mean"]
    for fid, points in curves.items():
        if not points:
            continue
        vals = [float(p.get("ic_mean") or 0) for p in points]
        mx = max(abs(v) for v in vals) or 1.0
        lines.append(f"[{fid}]")
        for p, v in zip(points, vals):
            h = p.get("horizon")
            bar_len = int(round(abs(v) / mx * width))
            sign = "+" if v >= 0 else "-"
            lines.append(f"  h={h:>3}: {sign}{'#' * bar_len} ({v:+.4f})")
    return "\n".join(lines)


def try_plot_ic_decay(charts_dir: Path, curves: Dict[str, List[Dict[str, Any]]]) -> Optional[Path]:
    ensure_dir(charts_dir)
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        return None

    fig, ax = plt.subplots(figsize=(8, 4.5))
    for fid, points in curves.items():
        if not points:
            continue
        hs = [p["horizon"] for p in points]
        ics = [p.get("ic_mean") for p in points]
        ax.plot(hs, ics, marker="o", label=fid)
    ax.axhline(0, color="#999", lw=0.8)
    ax.set_xlabel("horizon (days)")
    ax.set_ylabel("Rank IC mean")
    ax.set_title("Portfolio IC Decay Curves")
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)
    out = charts_dir / "ic_decay_family.png"
    fig.tight_layout()
    fig.savefig(out, dpi=120)
    plt.close(fig)
    return out


def _cell(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        return ",".join(str(x) for x in value)
    if value is None:
        return ""
    return str(value).replace("\n", " ").replace("|", "/")


def markdown_table(rows: Sequence[Dict[str, Any]], cols: Sequence[str]) -> str:
    if not rows:
        return "_（空）_"
    header = "| " + " | ".join(cols) + " |"
    sep = "| " + " | ".join("---" for _ in cols) + " |"
    body = []
    for r in rows:
        body.append("| " + " | ".join(_cell(r.get(c, "")) for c in cols) + " |")
    return "\n".join([header, sep, *body])


def build_runtime_report(
    *,
    l1: str,
    matrix: Sequence[Dict[str, Any]],
    candidates: Sequence[Dict[str, Any]],
    alerts: Sequence[Dict[str, Any]],
    ascii_chart: str,
    gaps: Sequence[str],
    rules_version: str,
    data_version: str,
    source_mode: str,
    as_of: str,
) -> str:
    mat_cols = [
        "factor_id",
        "factor_name",
        "primary_score",
        "rank_ic",
        "half_life",
        "crowding_level",
        "capital_consensus",
        "health_status",
        "signal",
        "gap_notes",
    ]
    cand_cols = ["factor_id", "action", "reasons", "suggested_next_step"]
    alert_cols = ["theme_or_symbol", "level", "scenario", "linked_factor_ids"]

    gap_block = "\n".join(f"- {g}" for g in gaps) if gaps else "- （无）"

    text = f"""# Alpha 多因子组合健康度守卫报告

## L1 结论

{l1}

- as_of: `{as_of}`
- source_mode: `{source_mode}`
- data_version: `{data_version}`
- rules_version: `{rules_version}`
- data_source: `Pandadata`

## L2 因子健康度矩阵

{markdown_table(matrix, mat_cols)}

## 拥挤度警示

{markdown_table(alerts, alert_cols)}

## 退休 / 重构候选清单

{markdown_table(candidates, cand_cols)}

## IC 衰减曲线（ASCII 降级可用）

```
{ascii_chart}
```

## 方法来源

- skill-factor-evaluate
- skill-factor-decay
- agent-crowding-risk-monitor
- skill-smart-money-profiler

## 缺口标注

{gap_block}

## 免责声明

{DISCLAIMER}
"""
    for bad in FORBIDDEN:
        if bad in text.replace(DISCLAIMER, ""):
            # 不阻断写出，由 validate 抓
            pass
    return text


def build_handoff(
    *,
    l1: str,
    as_of: str,
    run_dir: Path,
    candidates: Sequence[Dict[str, Any]],
    gaps: Sequence[str],
) -> str:
    actions = ", ".join(f"{c['factor_id']}:{c['action']}" for c in candidates) or "无动作候选"
    gap = "; ".join(gaps) if gaps else "无"
    return f"""# Handoff Card — Alpha Portfolio Guardian

- as_of: {as_of}
- 结论: {l1}
- 动作候选: {actions}
- 缺口: {gap}
- 产物目录: `.`（与本文件同级）

请下游研究员/Agent 只读本目录结构化文件；需要重算请显式进入研究态入口。

{DISCLAIMER}
"""


def write_report_pack(
    run_dir: Path,
    *,
    matrix: List[Dict[str, Any]],
    candidates: List[Dict[str, Any]],
    alerts: List[Dict[str, Any]],
    curves: Dict[str, List[Dict[str, Any]]],
    l1: str,
    gaps: List[str],
    run_summary: Dict[str, Any],
    validation: Dict[str, Any],
    rules_version: str,
    data_version: str,
    source_mode: str,
    as_of: str,
    deps_index: Dict[str, Any],
) -> Dict[str, str]:
    ensure_dir(run_dir)
    charts = ensure_dir(run_dir / "charts")
    ensure_dir(run_dir / "deps")

    paths: Dict[str, str] = {}

    def _rel(p: Path) -> str:
        return pack_rel(p, run_dir)

    write_csv(run_dir / "health_matrix.csv", matrix)
    paths["health_matrix_csv"] = _rel(run_dir / "health_matrix.csv")
    if try_write_parquet(run_dir / "health_matrix.parquet", matrix):
        paths["health_matrix_parquet"] = _rel(run_dir / "health_matrix.parquet")

    write_csv(run_dir / "retire_rebuild_candidates.csv", candidates)
    paths["retire_rebuild_csv"] = _rel(run_dir / "retire_rebuild_candidates.csv")

    write_json(run_dir / "crowding_alerts.json", alerts)
    paths["crowding_alerts"] = _rel(run_dir / "crowding_alerts.json")

    curve_payload = {
        "as_of_date": as_of,
        "curves": curves,
        "ascii": ascii_ic_decay(curves),
    }
    write_json(run_dir / "ic_decay_curves.json", curve_payload)
    paths["ic_decay_curves"] = _rel(run_dir / "ic_decay_curves.json")

    png = try_plot_ic_decay(charts, curves)
    if png:
        paths["ic_decay_png"] = _rel(Path(png))
    else:
        (charts / "ic_decay_ascii.txt").write_text(curve_payload["ascii"], encoding="utf-8")
        paths["ic_decay_ascii"] = _rel(charts / "ic_decay_ascii.txt")

    report = build_runtime_report(
        l1=l1,
        matrix=matrix,
        candidates=candidates,
        alerts=alerts,
        ascii_chart=curve_payload["ascii"],
        gaps=gaps,
        rules_version=rules_version,
        data_version=data_version,
        source_mode=source_mode,
        as_of=as_of,
    )
    (run_dir / "runtime_report.md").write_text(report, encoding="utf-8")
    paths["runtime_report"] = _rel(run_dir / "runtime_report.md")

    handoff = build_handoff(
        l1=l1, as_of=as_of, run_dir=run_dir, candidates=candidates, gaps=gaps
    )
    (run_dir / "handoff_card.md").write_text(handoff, encoding="utf-8")
    paths["handoff_card"] = _rel(run_dir / "handoff_card.md")

    summary_out = dict(run_summary)
    if "portfolio" in summary_out:
        summary_out["portfolio"] = portable_ref(summary_out.get("portfolio"))
    validation_out = dict(validation)
    # 产物包自描述：run_dir 锚点为包根
    validation_out["run_dir"] = "."

    snapshot = {
        "agent": "agent-alpha-portfolio-guardian",
        "as_of_date": as_of,
        "source_mode": source_mode,
        "data_source": "Pandadata" if source_mode != "mock" else "synthetic-mock",
        "synthetic": source_mode == "mock",
        "data_version": data_version,
        "rules_version": rules_version,
        "l1": l1,
        "n_factors": len(matrix),
        "n_candidates": len(candidates),
        "n_alerts": len(alerts),
        "gaps": gaps,
        "paths": paths,
    }
    write_json(run_dir / "agent_snapshot.json", snapshot)
    write_json(run_dir / "run_summary.json", summary_out)
    write_json(run_dir / "validation.json", validation_out)
    write_json(run_dir / "deps" / "index.json", deps_index)
    paths["agent_snapshot"] = _rel(run_dir / "agent_snapshot.json")
    paths["run_summary"] = _rel(run_dir / "run_summary.json")
    paths["validation"] = _rel(run_dir / "validation.json")
    return paths
