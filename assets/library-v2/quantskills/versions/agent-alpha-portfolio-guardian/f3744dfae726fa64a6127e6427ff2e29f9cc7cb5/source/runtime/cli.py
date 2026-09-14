# -*- coding: utf-8 -*-
"""统一入口：研究态全链路 / validate / publish / self-test / clean。"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"


def _ensure_paths() -> None:
    for p in (str(ROOT), str(SCRIPTS)):
        if p not in sys.path:
            sys.path.insert(0, p)


def cmd_run(args: argparse.Namespace) -> int:
    _ensure_paths()
    from runtime.graph import run

    portfolio = args.portfolio
    if args.mock:
        # 强制 mock 配置优先
        if not portfolio:
            portfolio = str(ROOT / "config" / "portfolio.mock.yaml")
    if not portfolio:
        portfolio = str(ROOT / "config" / "portfolio.example.yaml")

    # live 开关：若 --live 且配置为 mock，提示但不强制改文件；可用 --mock 覆盖
    print("=" * 60)
    print("  Alpha Portfolio Guardian")
    print(f"  portfolio={portfolio}")
    print(f"  live={args.live} mock_flag={args.mock}")
    print("=" * 60)

    state = run(
        portfolio,
        output_dir=args.output_dir,
        skip_validate=bool(args.no_validate),
    )
    print(f"[OK] L1: {state['l1']}")
    print(f"[OK] run_dir → {state['run_dir']}")
    v = state.get("validation") or {}
    if v.get("ok") is False:
        print("[WARN] validation failed:", v.get("errors"))
        return 1
    if v.get("warnings"):
        print("[WARN] validation warnings:", v.get("warnings"))
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    _ensure_paths()
    from validate_report import validate_run_dir

    run_dir = Path(args.run_dir)
    if not run_dir.is_absolute():
        run_dir = (ROOT / run_dir).resolve()
    result = validate_run_dir(run_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


def cmd_publish(args: argparse.Namespace) -> int:
    _ensure_paths()
    from publish_snapshot import publish

    run_dir = Path(args.run_from)
    if not run_dir.is_absolute():
        run_dir = (ROOT / run_dir).resolve()
    dest = publish(run_dir, Path(args.to) if args.to else ROOT / "reports" / "publish")
    print(f"[OK] published → {dest}")
    return 0


def cmd_self_test(args: argparse.Namespace) -> int:
    _ensure_paths()
    from runtime.rules import FactorEvidence, decide_factor
    from runtime.graph import run

    # 规则单测
    thr = {
        "half_life_healthy": 5.0,
        "half_life_fragile": 2.0,
        "primary_score_retire": -0.5,
        "ic_noise_abs": 0.005,
        "high_turnover": 0.6,
    }
    d1 = decide_factor(
        FactorEvidence(
            factor_id="T1",
            factor_name="t",
            primary_score=0.4,
            rank_ic=0.03,
            half_life=8.0,
            eval_ok=True,
            decay_ok=True,
            ic_by_horizon={1: 0.03, 5: 0.02, 20: 0.01},
        ),
        thr,
    )
    assert d1.signal == "keep", d1

    d2 = decide_factor(
        FactorEvidence(
            factor_id="T2",
            factor_name="rev",
            primary_score=0.1,
            rank_ic=-0.02,
            half_life=1.2,
            turnover=0.7,
            eval_ok=True,
            decay_ok=True,
            sign_reversal=False,
            ic_by_horizon={1: 0.02, 5: 0.01, 20: 0.005},
        ),
        thr,
    )
    assert d2.signal == "retire_candidate", d2

    d3 = decide_factor(
        FactorEvidence(
            factor_id="T3",
            factor_name="x",
            eval_ok=False,
            decay_ok=False,
        ),
        thr,
    )
    assert d3.signal == "insufficient", d3

    out = ROOT / "reports" / "runtime_out" / "_self_test"
    if out.exists():
        shutil.rmtree(out)
    state = run(
        "config/portfolio.mock.yaml",
        output_dir=out,
        skip_validate=False,
    )
    if not state["validation"].get("ok"):
        print("[FAIL] self-test validation:", state["validation"])
        return 1

    from runtime.panel_store import store_coverage, upsert_metrics
    from backtest import run_backtest, simulate_panels

    ps = state.get("panel_store") or {}
    if not ps.get("skipped"):
        print("[FAIL] mock run should skip panel store:", ps)
        return 1

    # 复制一份到 samples（结构样例）
    sample = ROOT / "reports" / "samples" / "mock_run"
    if sample.exists():
        shutil.rmtree(sample)
    shutil.copytree(out, sample)

    # 隔离 store 冒烟 --from-panel-store（不写默认 data/panels）
    iso_store = ROOT / "reports" / "runtime_out" / "_self_test_panel_store.parquet"
    if iso_store.exists():
        iso_store.unlink()
    sim_m, _ = simulate_panels("2024-01-01", "2025-12-31", 20, 20)
    upsert_metrics(sim_m, store=iso_store)
    cov = store_coverage(iso_store)
    if not cov.get("ok_for_backtest"):
        print("[FAIL] panel store coverage:", cov)
        return 1
    bt_store = run_backtest(
        argparse.Namespace(
            start_date="2024-01-01",
            end_date="2025-12-31",
            rebalance_days=20,
            horizon=20,
            metrics_panel="",
            fwd_panel="",
            from_panel_store=True,
            panel_store=str(iso_store),
            portfolio="config/portfolio.mock.yaml",
            output_dir=str(ROOT / "reports" / "backtest"),
            allow_simulate=False,
            rules_version="",
        )
    )
    if not (bt_store.get("meta") or {}).get("fwd_source"):
        print("[FAIL] from-panel-store missing fwd_source")
        return 1

    bt = run_backtest(
        argparse.Namespace(
            start_date="2024-01-01",
            end_date="2025-12-31",
            rebalance_days=20,
            horizon=20,
            metrics_panel="",
            fwd_panel="",
            from_panel_store=False,
            panel_store="",
            portfolio="config/portfolio.mock.yaml",
            output_dir=str(ROOT / "reports" / "backtest"),
            allow_simulate=True,
            rules_version="",
        )
    )
    bt_sample = ROOT / "reports" / "samples" / "backtest_mock"
    if bt_sample.exists():
        shutil.rmtree(bt_sample)
    shutil.copytree(bt["run_dir"], bt_sample)

    print("[OK] self-test passed")
    print(f"[OK] sample refreshed → {sample}")
    print(f"[OK] backtest sample → {bt_sample}")
    print(f"[OK] panel store → dates={cov.get('n_dates')} rows={cov.get('n_rows')}")
    print(f"[OK] L1: {state['l1']}")
    return 0


def cmd_backtest(args: argparse.Namespace) -> int:
    _ensure_paths()
    from backtest import run_backtest

    ns = argparse.Namespace(
        start_date=args.start_date,
        end_date=args.end_date,
        rebalance_days=args.rebalance_days,
        horizon=args.horizon,
        metrics_panel=args.metrics_panel or "",
        fwd_panel=args.fwd_panel or "",
        from_panel_store=bool(getattr(args, "from_panel_store", False)),
        panel_store=getattr(args, "panel_store", "") or "",
        portfolio=args.portfolio or "config/portfolio.mock.yaml",
        output_dir=args.output_dir or str(ROOT / "reports" / "backtest"),
        allow_simulate=bool(args.allow_simulate),
        rules_version=args.rules_version or "",
    )
    sources = [
        bool(ns.metrics_panel),
        bool(ns.from_panel_store),
        bool(ns.allow_simulate),
    ]
    if sum(sources) != 1:
        raise SystemExit(
            "backtest requires exactly one source: "
            "--from-panel-store | --metrics-panel PATH | --allow-simulate"
        )
    result = run_backtest(ns)
    print(f"[OK] backtest → {result['run_dir']}")
    if result.get("l4_html"):
        print(f"[OK] l4 → {result['l4_html']}")
    # refresh sample
    sample = ROOT / "reports" / "samples" / "backtest_mock"
    if sample.exists():
        shutil.rmtree(sample)
    shutil.copytree(result["run_dir"], sample)
    print(f"[OK] sample → {sample}")
    return 0


def cmd_clean(args: argparse.Namespace) -> int:
    target = ROOT / "reports" / "runtime_out"
    kept = 0
    for p in target.iterdir() if target.exists() else []:
        if p.name in {".gitkeep", "_self_test"} and not args.all:
            kept += 1
            continue
        if p.name == ".gitkeep":
            continue
        if p.is_dir():
            shutil.rmtree(p)
            print(f"removed {p}")
        elif p.name != ".gitkeep":
            p.unlink()
            print(f"removed {p}")
    print(f"[OK] clean done (kept placeholders)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    from datetime import date

    p = argparse.ArgumentParser(
        prog="python -m runtime",
        description="Alpha 多因子组合健康度守卫",
    )
    sub = p.add_subparsers(dest="command")

    # default run also via flags without subcommand
    p.add_argument("--live", action="store_true", help="研究态 live（需报告/凭证）")
    p.add_argument("--mock", action="store_true", help="使用 mock 组合配置跑通")
    p.add_argument("--portfolio", default=None, help="portfolio yaml")
    p.add_argument("--output-dir", default=None, help="输出目录")
    p.add_argument("--no-validate", action="store_true")

    v = sub.add_parser("validate", help="校验研究态产物")
    v.add_argument("run_dir")
    v.set_defaults(func=cmd_validate)

    pub = sub.add_parser("publish", help="发布快照")
    pub.add_argument("--from", dest="run_from", required=True)
    pub.add_argument("--to", default=None)
    pub.set_defaults(func=cmd_publish)

    st = sub.add_parser("self-test", help="规则单测 + mock 全链路")
    st.set_defaults(func=cmd_self_test)

    bt = sub.add_parser("backtest", help="守卫信号有效性回测")
    bt.add_argument("--start_date", default="2024-01-01")
    bt.add_argument("--end_date", default=date.today().isoformat())
    bt.add_argument("--rebalance-days", type=int, default=20)
    bt.add_argument("--horizon", type=int, default=20)
    bt.add_argument("--metrics-panel", default="")
    bt.add_argument("--fwd-panel", default="")
    bt.add_argument(
        "--from-panel-store",
        action="store_true",
        help="使用 data/panels 累积面板（研究态自动追加）",
    )
    bt.add_argument("--panel-store", default="", help="自定义 panel store 路径")
    bt.add_argument("--portfolio", default=None)
    bt.add_argument("--output-dir", default=None)
    bt.add_argument("--allow-simulate", action="store_true")
    bt.add_argument("--rules-version", default="")
    bt.set_defaults(func=cmd_backtest)

    cl = sub.add_parser("clean", help="清理 runtime_out")
    cl.add_argument("--all", action="store_true")
    cl.set_defaults(func=cmd_clean)

    return p


def main(argv: list | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if getattr(args, "func", None):
        return int(args.func(args))
    # 无子命令 → run
    if not args.mock and not args.live and not args.portfolio:
        args.mock = True
    return cmd_run(args)


if __name__ == "__main__":
    raise SystemExit(main())
