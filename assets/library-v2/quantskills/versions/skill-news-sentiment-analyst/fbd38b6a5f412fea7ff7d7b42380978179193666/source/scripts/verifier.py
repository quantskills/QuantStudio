#!/usr/bin/env python3
"""
PandaAI 验证器 — 输入股票代码列表，返回实时行情数据。

职责:
  - 接收股票代码列表 → 批量查询 PandaAI
  - 返回: 价格、融资方向、行业分类
  - 不调置信度、不做信号、不做任何分析

用法:
    python scripts/verifier.py --codes 300750,600519 --date 2026-07-09
    python scripts/verifier.py --codes 300750 --date 2026-07-09 --output verify.json
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("verifier")


# ── PandaAI 连接 ────────────────────────────────────────────

def _load_env() -> None:
    candidates = [
        os.getcwd(),
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ]
    for d in candidates:
        env_path = os.path.join(d, ".env")
        if os.path.isfile(env_path):
            with open(env_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, _, v = line.partition("=")
                    k, v = k.strip(), v.strip().strip("\"'")
                    if k and v and k not in os.environ:
                        os.environ[k] = v
            break


def _ensure_panda():
    _load_env()
    username = os.environ.get("PANDA_DATA_USERNAME", "").strip()
    password = os.environ.get("PANDA_DATA_PASSWORD", "").strip()
    if not username or not password:
        raise RuntimeError("PandaAI 未配置。请创建 .env 文件并填入 PANDA_DATA_USERNAME/PANDA_DATA_PASSWORD")
    import panda_data
    panda_data.init_token(username=username, password=password)
    return panda_data


def _fmt(code: str) -> str:
    """6位代码 → PandaAI 格式"""
    if len(code) == 6:
        return f"{code}.SZ" if code.startswith(("0", "3")) else f"{code}.SH"
    return code


def _is_empty(df) -> bool:
    if df is None:
        return True
    if hasattr(df, "empty") and df.empty:
        return True
    if isinstance(df, list):
        return len(df) == 0
    return False


# ── 批量验证 ────────────────────────────────────────────────

def verify_codes(codes: List[str], trade_date: str) -> Dict:
    """批量查询每只股票的价格/融资/行业"""
    result = {}
    if not codes:
        return result

    pd_mod = _ensure_panda()
    date_fmt = trade_date.replace("-", "")
    start_7d = (datetime.strptime(trade_date, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y%m%d")

    for code in codes:
        entry = {}
        sym = _fmt(code)

        # 价格
        try:
            px = pd_mod.get_stock_daily(
                symbol=sym, start_date=start_7d, end_date=date_fmt, fields=["close"]
            )
            if not _is_empty(px):
                closes = px["close"].tolist()
                if len(closes) >= 2:
                    entry["price_1d"] = round((closes[-1] - closes[-2]) / closes[-2] * 100, 2)
                    entry["price_5d"] = (
                        round((closes[-1] - closes[0]) / closes[0] * 100, 2)
                        if len(closes) >= 5 else None
                    )
                    entry["close"] = closes[-1]
        except Exception:
            pass

        # 融资
        try:
            mg = pd_mod.get_margin(
                symbol=sym,
                start_date=start_7d,
                end_date=date_fmt,
            )
            if not _is_empty(mg) and "margin_balance" in mg.columns and len(mg) >= 2:
                a, b = mg["margin_balance"].iloc[0], mg["margin_balance"].iloc[-1]
                entry["margin"] = "up" if b > a else "down"
        except Exception:
            pass

        # 行业
        try:
            ind = pd_mod.get_stock_industry(stock_symbol=sym)
            if not _is_empty(ind):
                row = ind.iloc[0].to_dict() if hasattr(ind, "iloc") else ind
                entry["industry"] = row.get("industry_name", str(row)[:20])
        except Exception:
            pass

        if entry:
            result[code] = entry

    return result


# ── CLI ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PandaAI 验证器")
    parser.add_argument("--codes", required=True, help="股票代码逗号分隔, 如 300750,600519")
    parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"))
    parser.add_argument("--output", default=None, help="JSON 输出路径")
    args = parser.parse_args()

    codes = [c.strip() for c in args.codes.split(",") if c.strip()]

    if not codes:
        print("[]")
        return

    data = verify_codes(codes, args.date)
    output = json.dumps(data, ensure_ascii=False, indent=2, default=str)

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"  ✅ {len(data)}/{len(codes)} 只股票已验证 → {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
