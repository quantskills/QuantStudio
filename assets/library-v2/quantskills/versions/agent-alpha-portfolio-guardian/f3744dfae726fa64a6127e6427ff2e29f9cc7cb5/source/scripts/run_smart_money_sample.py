# -*- coding: utf-8 -*-
"""抽样桥接 skill-smart-money-profiler（合力/分歧旁证，不改主分）。"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_json(path: Optional[Path]) -> Optional[Any]:
    if path and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def sample_consensus(
    *,
    cfg: Dict[str, Any],
    source_mode: str,
) -> Dict[str, Any]:
    from runtime.config_loader import collect_exposure_symbols

    sm = cfg.get("smart_money") or {}
    if not sm.get("enabled", True):
        return {"ok": True, "by_symbol": {}, "factor_consensus": {}, "gap": None}

    sample_path = sm.get("sample_path")
    path = Path(sample_path) if sample_path else None
    if path and not path.is_absolute():
        path = (ROOT / path).resolve()
    pre = _load_json(path)
    if pre:
        return {
            "ok": True,
            "by_symbol": pre.get("by_symbol") or pre,
            "factor_consensus": pre.get("factor_consensus") or {},
            "gap": None,
            "source": "sample_path",
            "note": "席位身份标签来自规则匹配，不等于官方认定",
        }

    symbols = collect_exposure_symbols(cfg)
    # themes like market_hot are not stock codes — filter rough stock-like
    stock_like = [s for s in symbols if "." in s and any(ch.isdigit() for ch in s)]
    top_n = int(sm.get("top_n_symbols") or 10)
    stock_like = stock_like[:top_n]

    if source_mode == "mock":
        by_symbol = {}
        for i, sym in enumerate(stock_like or ["600519.SH"]):
            by_symbol[sym] = {
                "consensus": "divergent" if i % 2 else "aligned",
                "sources": {
                    "northbound": "buy" if i % 2 == 0 else "sell",
                    "lhb_institution": "buy",
                    "margin": "buy" if i % 2 == 0 else "sell",
                    "block": "no_data",
                },
                "label_note": "规则匹配/推断，非官方认定",
            }
        # 因子级汇总：若任一暴露标的 divergent → divergent
        factor_consensus = {}
        for fac in cfg["factors"]:
            exps = fac.get("exposure_symbols") or list(by_symbol.keys())[:1]
            cons = []
            for s in exps:
                if s in by_symbol:
                    cons.append(by_symbol[s]["consensus"])
            if "divergent" in cons:
                factor_consensus[fac["factor_id"]] = "divergent"
            elif "aligned" in cons:
                factor_consensus[fac["factor_id"]] = "aligned"
            else:
                factor_consensus[fac["factor_id"]] = "no_data"
        return {
            "ok": True,
            "by_symbol": by_symbol,
            "factor_consensus": factor_consensus,
            "gap": None,
            "source": "mock",
            "note": "席位身份标签来自规则匹配，不等于官方认定；胜率为事后回看。",
        }

    # live 无预置样本：显式缺口，不编造
    factor_consensus = {f["factor_id"]: "no_data" for f in cfg["factors"]}
    return {
        "ok": False,
        "by_symbol": {},
        "factor_consensus": factor_consensus,
        "gap": (
            "smart-money live 抽样需宿主按 skill-smart-money-profiler 对 Top 暴露标的执行；"
            "或提供 smart_money.sample_path JSON"
        ),
        "source": "gap",
        "symbols_requested": stock_like,
        "note": "不编造合力/分歧结论",
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--portfolio", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)

    from runtime.config_loader import load_portfolio

    cfg = load_portfolio(args.portfolio)
    payload = sample_consensus(cfg=cfg, source_mode=cfg["source_mode"])
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] smart-money sample → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
