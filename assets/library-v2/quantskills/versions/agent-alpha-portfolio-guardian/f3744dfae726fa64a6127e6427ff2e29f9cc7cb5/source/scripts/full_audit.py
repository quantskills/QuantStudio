# -*- coding: utf-8 -*-
"""全量审计：结构 / Schema / 合规 / CLI / 规则 / 降级。输出 JSON 到 stdout 与 runtime_out。"""
from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT), str(ROOT / "scripts")]


def main() -> int:
    results = []

    def ok(name: str, cond: bool, detail: str = "") -> None:
        results.append({"name": name, "pass": bool(cond), "detail": str(detail)})
        print(("PASS" if cond else "FAIL"), name, detail)

    # --- schema ---
    req_matrix = [
        "as_of_date",
        "factor_id",
        "factor_name",
        "primary_score",
        "rank_ic",
        "pearson_ic",
        "ic_ir",
        "half_life",
        "half_life_ci_low",
        "half_life_ci_high",
        "recommended_rebalance",
        "crowding_level",
        "capital_consensus",
        "health_status",
        "signal",
        "confidence",
        "gap_notes",
        "data_version",
        "update_time",
        "source_mode",
    ]
    mat = ROOT / "reports/samples/mock_run/health_matrix.csv"
    with mat.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    cols = set(rows[0].keys()) if rows else set()
    missing = [c for c in req_matrix if c not in cols]
    ok("schema.health_matrix_fields", not missing, f"missing={missing}")
    ok("schema.signal_coarse", "signal_coarse" in cols)
    ok("schema.n_factors", len(rows) == 3, f"n={len(rows)}")
    signals = {r["signal"] for r in rows}
    ok(
        "schema.signal_mix",
        {"keep", "watch", "rebuild_candidate"} <= signals,
        f"signals={signals}",
    )
    keys = [(r["as_of_date"], r["factor_id"], r["data_version"]) for r in rows]
    ok("schema.pk_unique", len(keys) == len(set(keys)))

    cand_path = ROOT / "reports/samples/mock_run/retire_rebuild_candidates.csv"
    with cand_path.open(encoding="utf-8-sig") as f:
        cand = list(csv.DictReader(f))
    ok("deliverable.retire_rebuild", len(cand) >= 1, f"n={len(cand)}")
    ok(
        "deliverable.candidate_fields",
        bool(cand)
        and all(
            k in cand[0]
            for k in ["action", "reasons", "suggested_next_step", "alpha_research_ticket"]
        ),
    )
    alerts = json.loads(
        (ROOT / "reports/samples/mock_run/crowding_alerts.json").read_text(encoding="utf-8")
    )
    ok("deliverable.crowding_alerts", isinstance(alerts, list) and len(alerts) >= 1)
    curves = json.loads(
        (ROOT / "reports/samples/mock_run/ic_decay_curves.json").read_text(encoding="utf-8")
    )
    ok("deliverable.ic_decay_curves", "curves" in curves and len(curves["curves"]) == 3)
    chart_png = ROOT / "reports/samples/mock_run/charts/ic_decay_family.png"
    chart_ascii = ROOT / "reports/samples/mock_run/charts/ic_decay_ascii.txt"
    ok(
        "deliverable.ic_chart",
        chart_png.exists() or chart_ascii.exists(),
        f"png={chart_png.exists()} ascii={chart_ascii.exists()}",
    )
    ok(
        "optional.parquet",
        (ROOT / "reports/samples/mock_run/health_matrix.parquet").exists(),
        f"exists={(ROOT / 'reports/samples/mock_run/health_matrix.parquet').exists()}",
    )

    report = (ROOT / "reports/samples/mock_run/runtime_report.md").read_text(encoding="utf-8")
    forbidden = ["买入", "卖出", "必涨", "仓位提到"]
    hit = [w for w in forbidden if w in report]
    ok("compliance.no_trade_orders", not hit, f"hit={hit}")
    ok("compliance.disclaimer", "不构成任何投资建议" in report)
    ok(
        "compliance.method_sources",
        all(x in report for x in ["factor-evaluate", "factor-decay", "crowding", "smart-money"]),
    )
    ok("version.mock_prefix", all("mock" in r["data_version"] for r in rows))

    from validate_report import validate_run_dir

    import os

    from runtime.pandadata_gate import (
        PandadataRedLineError,
        enforce_live_red_line,
        is_pandadata_source,
    )

    bad_cfg = {
        "source_mode": "live",
        "data_source": "Tushare",
        "factors": [],
        "crowding": {},
        "smart_money": {},
    }
    try:
        enforce_live_red_line(bad_cfg)
        ok("redline.reject_tushare", False, "should have raised")
    except PandadataRedLineError:
        ok("redline.reject_tushare", True)

    ok("redline.accept_token", is_pandadata_source("Pandadata"))
    ok("redline.reject_yahoo", not is_pandadata_source("yahoo-finance"))

    cache_dir = ROOT / "reports" / "runtime_out" / "_redline_cache_fixture"
    cache_dir.mkdir(parents=True, exist_ok=True)
    score = cache_dir / "F001_score.json"
    score.write_text(
        json.dumps(
            {
                "data_source": "Pandadata",
                "delivery": "via_skill",
                "via_skill": "skill-factor-evaluate",
                "data_asof": "2026-07-31",
                "primary_score": 0.3,
                "rank_ic": 0.02,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    cache_cfg = {
        "source_mode": "live",
        "data_source": "Pandadata",
        "allow_pandadata_cache": True,
        "factors": [
            {
                "factor_id": "F001",
                "score_report_path": score,
            }
        ],
        "crowding": {},
        "smart_money": {},
    }
    try:
        rl_cache = enforce_live_red_line(cache_cfg)
        ok(
            "redline.cache_without_creds",
            rl_cache.get("ok") is True and rl_cache.get("pandadata_cache_hits", 0) >= 1,
            rl_cache,
        )
    except PandadataRedLineError as e:
        ok("redline.cache_without_creds", False, str(e))

    env = os.environ.copy()
    for k in (
        "PANDA_DATA_USERNAME",
        "PANDA_DATA_PASSWORD",
        "PANDADATA_USERNAME",
        "PANDADATA_PASSWORD",
    ):
        env.pop(k, None)
    r = subprocess.run(
        [
            sys.executable,
            "-m",
            "runtime",
            "--portfolio",
            "config/portfolio.example.yaml",
            "--live",
            "--output-dir",
            "reports/runtime_out/_full_test_live_noredline",
        ],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        env=env,
    )
    joined = (r.stderr or "") + (r.stdout or "")
    ok(
        "live_no_cred.hard_fail",
        r.returncode != 0
        and ("data source check failed" in joined or "credentials are missing" in joined),
        joined[-240:],
    )

    for script, args in [
        (
            "run_evaluate_batch.py",
            [
                "--portfolio",
                "config/portfolio.mock.yaml",
                "--output",
                "reports/runtime_out/_cli_scores.json",
            ],
        ),
        (
            "run_decay_batch.py",
            [
                "--portfolio",
                "config/portfolio.mock.yaml",
                "--output",
                "reports/runtime_out/_cli_decays.json",
            ],
        ),
        (
            "run_crowding_bridge.py",
            [
                "--portfolio",
                "config/portfolio.mock.yaml",
                "--output",
                "reports/runtime_out/_cli_crowd.json",
            ],
        ),
        (
            "run_smart_money_sample.py",
            [
                "--portfolio",
                "config/portfolio.mock.yaml",
                "--output",
                "reports/runtime_out/_cli_sm.json",
            ],
        ),
        (
            "aggregate_health.py",
            [
                "--portfolio",
                "config/portfolio.mock.yaml",
                "--scores",
                "reports/runtime_out/_cli_scores.json",
                "--decays",
                "reports/runtime_out/_cli_decays.json",
                "--crowding",
                "reports/runtime_out/_cli_crowd.json",
                "--smart-money",
                "reports/runtime_out/_cli_sm.json",
                "--output",
                "reports/runtime_out/_cli_agg.json",
            ],
        ),
    ]:
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / script), *args],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        ok(f"cli.{script}", r.returncode == 0, ((r.stderr or r.stdout) or "")[-160:])

    from runtime.rules import FactorEvidence, decide_factor, map_crowding_scenario

    thr: dict = {}
    d = decide_factor(
        FactorEvidence(
            "X",
            "x",
            primary_score=0.2,
            rank_ic=0.02,
            half_life=1.0,
            turnover=0.9,
            eval_ok=True,
            decay_ok=True,
            ic_by_horizon={1: 0.02, 20: 0.01},
        ),
        thr,
    )
    ok("rules.retire_high_to", d.signal == "retire_candidate", d.signal)
    d = decide_factor(
        FactorEvidence(
            "Y",
            "y",
            primary_score=-0.8,
            rank_ic=0.0,
            eval_ok=True,
            decay_ok=True,
            ic_by_horizon={1: 0.001, 5: 0.001, 20: 0.0},
        ),
        thr,
    )
    ok("rules.retire_noise", d.signal == "retire_candidate", d.signal)
    d = decide_factor(
        FactorEvidence(
            "Z",
            "z",
            primary_score=0.4,
            half_life=8,
            eval_ok=True,
            decay_ok=True,
            crowding_level="critical",
            ic_by_horizon={1: 0.03, 20: 0.01},
        ),
        thr,
    )
    ok("rules.deweight_critical_crowd", d.signal == "deweight", d.signal)
    ok("rules.map_crowding", map_crowding_scenario("延续", "") == "info")

    from runtime.panel_store import (
        build_fwd_from_metrics,
        health_matrix_to_metrics,
        upsert_metrics,
    )
    import pandas as pd

    hm = pd.read_csv(ROOT / "reports/samples/mock_run/health_matrix.csv")
    metrics_one = health_matrix_to_metrics(hm)
    ok("panel.health_to_metrics", len(metrics_one) == 3 and "date" in metrics_one.columns)
    tmp_store = ROOT / "reports" / "runtime_out" / "_panel_store_audit.parquet"
    if tmp_store.exists():
        tmp_store.unlink()
    # 两期以便拼 fwd
    m2 = metrics_one.copy()
    m2["date"] = "2026-06-30"
    upsert_metrics(pd.concat([metrics_one, m2], ignore_index=True), store=tmp_store)
    fwd, src = build_fwd_from_metrics(
        pd.concat([metrics_one, m2], ignore_index=True), horizon=20
    )
    ok("panel.build_fwd_approx", len(fwd) >= 1 and src == "next_rank_ic_approx", f"n={len(fwd)}")

    from runtime.trade_calendar import evaluate_calendar_row

    trade_ok = evaluate_calendar_row(
        "2026-07-31", {"nature_date": 20260731, "is_trade": 1, "pretrade_date": "20260730"}
    )
    ok("calendar.accept_trade_day", trade_ok.get("ok") is True, trade_ok)
    trade_bad = evaluate_calendar_row(
        "2026-08-01",
        {
            "nature_date": 20260801,
            "is_trade": 0,
            "pretrade_date": "20260731",
            "next_trade_date": "20260804",
        },
    )
    ok(
        "calendar.reject_non_trade_day",
        trade_bad.get("ok") is False and trade_bad.get("suggested_as_of") == "2026-07-31",
        trade_bad,
    )

    # 样例不得残留他机绝对路径
    abs_hits = []
    sample_roots = [
        ROOT / "reports" / "samples" / "mock_run",
        ROOT / "reports" / "samples" / "backtest_mock",
    ]
    for sroot in sample_roots:
        if not sroot.exists():
            continue
        for fp in sroot.rglob("*"):
            if not fp.is_file():
                continue
            if fp.suffix.lower() not in {".json", ".md", ".html", ".csv", ".txt"}:
                continue
            try:
                text = fp.read_text(encoding="utf-8")
            except Exception:
                continue
            if "ProjectGeek" in text or ":\\" in text or "/Users/" in text or "/home/" in text:
                # 允许文档中以相对路径示例提及仓库名；仅拦盘符/用户目录形态
                if ":\\" in text or "/Users/" in text or "/home/" in text:
                    abs_hits.append(str(fp.relative_to(ROOT)))
    ok("samples.no_machine_abs_paths", not abs_hits, abs_hits[:8])

    required_paths = [
        "AGENTS.md",
        "README.md",
        "README.en.md",
        "LICENSE",
        "requirements.txt",
        ".env.example",
        ".gitignore",
        "config/portfolio.example.yaml",
        "config/portfolio.mock.yaml",
        "runtime/__main__.py",
        "runtime/cli.py",
        "runtime/graph.py",
        "runtime/rules.py",
        "runtime/writers.py",
        "runtime/config_loader.py",
        "runtime/trade_calendar.py",
        "runtime/paths.py",
        "runtime/panel_store.py",
        "data/panels/README.md",
        "scripts/run_evaluate_batch.py",
        "scripts/run_decay_batch.py",
        "scripts/run_crowding_bridge.py",
        "scripts/run_smart_money_sample.py",
        "scripts/aggregate_health.py",
        "scripts/validate_report.py",
        "scripts/publish_snapshot.py",
        "scripts/test_rules.py",
        "references/data_guide.md",
        "references/decision-rules.md",
        "references/dependency-contracts.md",
        "references/agent-boundary.md",
        "agents/skill-manifest.yaml",
        "agents/cursor-rule.mdc",
        "agents/openai.yaml",
        "agents/portable-loader.md",
        "templates/runtime_report.md.j2",
        "templates/l4_backtest.html",
        "scripts/export_l4_backtest.py",
        "reports/samples/mock_run/runtime_report.md",
        "reports/samples/backtest_mock/l4.html",
    ]
    miss_paths = [p for p in required_paths if not (ROOT / p).exists()]
    # README 应承载原使用手册要点（配置 / 命令 / 读报告）
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for needle in ("portfolio.example.yaml", "as_of_calendar", "--from-panel-store", "health_matrix"):
        if needle not in readme:
            miss_paths.append(f"README.md missing:{needle}")
    ok("structure.design_files", not miss_paths, f"missing={miss_paths}")

    broken = ROOT / "reports/runtime_out/_broken_validate"
    if broken.exists():
        shutil.rmtree(broken)
    broken.mkdir(parents=True)
    (broken / "runtime_report.md").write_text("bad", encoding="utf-8")
    vbad = validate_run_dir(broken)
    ok("validate.catches_incomplete", not vbad["ok"], f"errors={vbad['errors'][:3]}")

    # publish gate
    pub = subprocess.run(
        [
            sys.executable,
            "-m",
            "runtime",
            "publish",
            "--from",
            str(broken),
        ],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    ok("publish.refuse_invalid", pub.returncode != 0, (pub.stderr or pub.stdout)[-160:])

    known_gaps = [
        "live evaluate/decay 仍为报告桥接/缓存消费，未进程内调用依赖计算入口（evaluate Skill 无 Python 计算入口）",
        "live smart-money 需预置 sample_path 或宿主执行 Skill",
        "panel store 后验默认 next_rank_ic 近似；真实 fwd_ret 仍需用户 fwd_panel 或更长实盘累积",
    ]

    n_pass = sum(1 for r in results if r["pass"])
    n_fail = sum(1 for r in results if not r["pass"])
    summary = {
        "n_checks": len(results),
        "n_pass": n_pass,
        "n_fail": n_fail,
        "pass_rate": round(n_pass / len(results) * 100, 1) if results else 0.0,
        "known_gaps": known_gaps,
        "results": results,
    }
    out = ROOT / "reports/runtime_out/_full_test_audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("---")
    print(
        json.dumps(
            {
                "n_checks": summary["n_checks"],
                "n_pass": n_pass,
                "n_fail": n_fail,
                "pass_rate": summary["pass_rate"],
                "audit_json": str(out),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
