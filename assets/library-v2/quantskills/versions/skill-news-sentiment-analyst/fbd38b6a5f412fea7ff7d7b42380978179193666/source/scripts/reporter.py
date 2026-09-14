#!/usr/bin/env python3
"""
报告生成器 — 输入 AI 分析结果 + PandaAI 验证数据，生成终端报告 + Parquet。

职责:
  - 读取 AI 分析的 JSON 文件（新闻 + 股票识别）
  - 读取 PandaAI 验证的 JSON 文件（价格/融资/行业）
  - 输出: rich 彩色终端报告 + Parquet 持久化文件

用法:
    python scripts/reporter.py --analysis analysis.json
    python scripts/reporter.py --analysis analysis.json --verify verify.json --output-dir output
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("reporter")

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


# ── 数据模型 ────────────────────────────────────────────────

BUILD_ID = "NSA"
BUILD_NAME = "News Sentiment Analyst"
DATA_VERSION = "2.0.0"


# ── 报告生成 ────────────────────────────────────────────────

def _fmt_pct(val: Optional[float], prefix: str = "") -> str:
    if val is None:
        return "  N/A  "
    s = f"{val:+.2f}%"
    return s if not prefix else f"{prefix}{s}"


def _sentiment_emoji(s: str) -> str:
    return {"positive": "🟢", "negative": "🔴", "neutral": "⚪"}.get(s, "⚪")


def generate_report(analysis: List[Dict],
                    verify: Optional[Dict] = None,
                    market_ctx: Optional[Dict] = None) -> str:
    """生成终端报告（纯文本 fallback / rich 增强）"""
    lines = []
    sep = "=" * 72

    lines.append(sep)
    lines.append(f"  A 股新闻分析日报")
    lines.append(sep)
    lines.append("")

    # 市场背景
    if market_ctx:
        indices = market_ctx.get("indices", {})
        sh = indices.get("sh")
        cy = indices.get("cy")
        parts = []
        if sh:
            parts.append(f"上证 {sh.get('close','?')} ({sh.get('pct',0):+.2f}%)")
        if cy:
            parts.append(f"创业板 {cy.get('close','?')} ({cy.get('pct',0):+.2f}%)")
        nb = market_ctx.get("northbound")
        if nb is not None:
            parts.append(f"北向 {nb} 条")
        lhb = market_ctx.get("lhb_count", 0)
        if lhb:
            parts.append(f"龙虎榜 {lhb} 只")
        if parts:
            lines.append(f"  📊 市场概况:  {' | '.join(parts)}")

        top = market_ctx.get("top_sectors", [])
        if top:
            secs = [f"{s['name']}({s['pct']:+.2f}%)" for s in top[:3]]
            lines.append(f"  🔥 热点板块:  {', '.join(secs)}")
        lines.append("")

    # 新闻逐条分析
    lines.append(f"  📰 共 {len(analysis)} 条新闻分析")
    lines.append("")

    all_stocks = {}
    stock_mentions = {}

    for i, item in enumerate(analysis, 1):
        title = item.get("news_title", item.get("title", ""))
        sentiment = item.get("sentiment", "neutral")
        emoji = _sentiment_emoji(sentiment)
        stocks = item.get("affected_stocks", [])
        sectors = item.get("affected_sectors", [])
        reasoning = item.get("reasoning", "")

        lines.append(f"  [{i:2d}] {emoji} {title[:70]}")

        if sectors:
            lines.append(f"       板块: {', '.join(sectors)}")

        if stocks:
            for s in stocks:
                code = s.get("code", "")
                name = s.get("name", "")
                impact = s.get("impact", "")
                reason = s.get("reason", "")
                imoji = "🟢" if impact == "positive" else ("🔴" if impact == "negative" else "⚪")

                # PandaAI 验证数据
                v = (verify or {}).get(code, {})
                p1 = _fmt_pct(v.get("price_1d"), "")
                mg = v.get("margin", "")
                mg_s = f" 融资{'↑' if mg=='up' else '↓'}" if mg else ""
                ind = v.get("industry", "")

                line = f"       {imoji} {name}({code})"
                if p1 != "  N/A  ":
                    line += f"  {p1}"
                line += mg_s
                if ind:
                    line += f"  {ind}"
                if reason:
                    line += f"  — {reason}"
                lines.append(line)

                # 统计
                if code:
                    all_stocks[code] = name
                    stock_mentions[code] = stock_mentions.get(code, 0) + 1

        if reasoning:
            lines.append(f"       💡 {reasoning[:120]}")

        lines.append("")

    # 总览
    lines.append(sep)
    lines.append(f"  总览")
    lines.append(sep)
    lines.append(f"  新闻: {len(analysis)} 条 | 涉及股票: {len(all_stocks)} 只")

    if stock_mentions:
        hot = sorted(stock_mentions.items(), key=lambda x: -x[1])[:5]
        hot_strs = [f"{all_stocks.get(c,c)}({c}) {n}次" for c, n in hot]
        lines.append(f"  热点: {', '.join(hot_strs)}")

    positive = sum(1 for a in analysis if a.get("sentiment") == "positive")
    negative = sum(1 for a in analysis if a.get("sentiment") == "negative")
    neutral = sum(1 for a in analysis if a.get("sentiment") == "neutral")
    lines.append(f"  情绪: 🟢{positive}  🔴{negative}  ⚪{neutral}")

    lines.append(sep)

    return "\n".join(lines)


# ── Parquet 持久化 ──────────────────────────────────────────

def save_to_parquet(analysis: List[Dict],
                    trade_date: str,
                    output_dir: str = "output",
                    verify: Optional[Dict] = None) -> str:
    """将 AI 分析结果保存为 Parquet"""
    records = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for item in analysis:
        title = item.get("news_title", item.get("title", ""))
        stocks = item.get("affected_stocks", [])

        stock_list = []
        for s in stocks:
            code = s.get("code", "")
            v = (verify or {}).get(code, {})
            stock_list.append({
                "code": code,
                "name": s.get("name", ""),
                "impact": s.get("impact", ""),
                "reason": s.get("reason", ""),
                "price_1d": v.get("price_1d"),
                "margin": v.get("margin"),
                "industry": v.get("industry"),
            })

        records.append({
            "trade_date": trade_date,
            "build_id": BUILD_ID,
            "build_name": BUILD_NAME,
            "result_type": "news_analysis",
            "result_value": "data_ready",
            "result_json": json.dumps({
                "news_title": title,
                "affected_stocks": stock_list,
                "affected_sectors": item.get("affected_sectors", []),
                "sentiment": item.get("sentiment", "neutral"),
                "reasoning": item.get("reasoning", ""),
            }, ensure_ascii=False),
            "data_version": DATA_VERSION,
            "update_time": now,
        })

    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, f"news_analysis_{trade_date}.parquet")
    df = pd.DataFrame(records)
    df.to_parquet(path, index=False, engine="pyarrow")
    logger.info(f"  ✅ Parquet → {path}")
    return path


# ── rich 增强版报告 ─────────────────────────────────────────

def _rich_report(analysis: List[Dict],
                 verify: Optional[Dict] = None,
                 market_ctx: Optional[Dict] = None) -> str:
    """使用 rich 生成更精美的终端报告"""
    if not RICH_AVAILABLE:
        return generate_report(analysis, verify, market_ctx)

    console = Console(width=100, force_terminal=True)
    lines = []

    # 市场概况表
    if market_ctx:
        t = Table(title="市场概况", box=box.ROUNDED)
        t.add_column("指标", style="cyan")
        t.add_column("数值", style="white")
        indices = market_ctx.get("indices", {})
        sh = indices.get("sh")
        cy = indices.get("cy")
        if sh:
            t.add_row("上证指数", f"{sh.get('close','?')}  ({sh.get('pct',0):+.2f}%)")
        if cy:
            t.add_row("创业板指", f"{cy.get('close','?')}  ({cy.get('pct',0):+.2f}%)")
        nb = market_ctx.get("northbound")
        if nb is not None:
            t.add_row("北向资金", f"{nb} 条记录")
        lhb = market_ctx.get("lhb_count", 0)
        if lhb:
            t.add_row("龙虎榜", f"{lhb} 只上榜")
        top = market_ctx.get("top_sectors", [])
        if top:
            secs = "\n".join(f"  {s['name']}  {s['pct']:+.2f}%" for s in top[:5])
            t.add_row("板块涨幅 TOP5", secs)

        with console.capture() as capture:
            console.print(t)
        lines.append(capture.get())
        lines.append("")

    # 新闻分析
    stock_stats = {}
    pos = neg = neu = 0

    for i, item in enumerate(analysis, 1):
        title = item.get("news_title", item.get("title", ""))
        sentiment = item.get("sentiment", "neutral")
        stocks = item.get("affected_stocks", [])
        sectors = item.get("affected_sectors", [])
        reasoning = item.get("reasoning", "")

        if sentiment == "positive":
            pos += 1
        elif sentiment == "negative":
            neg += 1
        else:
            neu += 1

        t = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
        t.add_column("", style="bold", width=3)
        t.add_column("", width=70)

        emoji = _sentiment_emoji(sentiment)
        t.add_row(f"[{i}]", f"{emoji} {title[:68]}")

        if sectors:
            t.add_row("", f"    板块: {', '.join(sectors[:4])}")

        if stocks:
            for s in stocks:
                code = s.get("code", "")
                name = s.get("name", "")
                impact = s.get("impact", "")
                r = s.get("reason", "")
                imoji = "🟢" if impact == "positive" else ("🔴" if impact == "negative" else "⚪")

                v = (verify or {}).get(code, {})
                p1 = _fmt_pct(v.get("price_1d"), "")
                mg = v.get("margin", "")
                mg_s = f"融资{'↑' if mg=='up' else '↓'}" if mg else ""
                ind = v.get("industry", "")

                parts = [f"     {imoji} {name}({code})"]
                if p1 != "  N/A  ":
                    parts.append(p1)
                if mg_s:
                    parts.append(mg_s)
                if ind:
                    parts.append(ind)
                t.add_row("", "  ".join(parts))

                if code:
                    stock_stats[code] = stock_stats.get(code, 0) + 1

                if r:
                    t.add_row("", f"      └ {r[:60]}")

        if reasoning:
            t.add_row("", f"    💡 {reasoning[:100]}")

        with console.capture() as capture:
            console.print(t)
        lines.append(capture.get())
        lines.append("")

    # 总览
    t = Table(title="总览", box=box.ROUNDED)
    t.add_column("指标", style="cyan")
    t.add_column("数值")
    t.add_row("新闻", f"{len(analysis)} 条")
    t.add_row("涉及股票", f"{len(stock_stats)} 只")
    if stock_stats:
        hot = sorted(stock_stats.items(), key=lambda x: -x[1])[:5]
        hot_str = " | ".join([f"{c}({n}次)" for c, n in hot])
        t.add_row("高频股票", hot_str)
    t.add_row("情绪", f"🟢{pos}  🔴{neg}  ⚪{neu}")
    with console.capture() as capture:
        console.print(t)
    lines.append(capture.get())

    return "\n".join(lines)


# ── CLI ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="新闻报告生成器")
    parser.add_argument("--analysis", required=True, help="AI 分析结果 JSON 路径")
    parser.add_argument("--verify", default=None, help="PandaAI 验证 JSON 路径")
    parser.add_argument("--market", default=None, help="市场背景 JSON 路径")
    parser.add_argument("--trade-date", default=None, help="交易日期")
    parser.add_argument("--output-dir", default="output")
    parser.add_argument("--no-rich", action="store_true", help="禁用 rich 格式")
    args = parser.parse_args()

    # 读取分析结果
    if not os.path.isfile(args.analysis):
        print(f"❌ 文件不存在: {args.analysis}")
        sys.exit(1)

    with open(args.analysis, "r", encoding="utf-8") as f:
        analysis = json.load(f)

    if isinstance(analysis, dict):
        analysis = analysis.get("analysis", [analysis])

    # 读取验证结果
    verify = None
    if args.verify and os.path.isfile(args.verify):
        with open(args.verify, "r", encoding="utf-8") as f:
            verify = json.load(f)

    # 读取市场背景
    market = None
    if args.market and os.path.isfile(args.market):
        with open(args.market, "r", encoding="utf-8") as f:
            market = json.load(f)

    trade_date = args.trade_date or (analysis[0].get("trade_date", "") if analysis else "")

    # 生成报告
    if args.no_rich or not RICH_AVAILABLE:
        report = generate_report(analysis, verify, market)
    else:
        report = _rich_report(analysis, verify, market)

    print(report)

    # 保存 Parquet
    if trade_date:
        save_to_parquet(analysis, trade_date, args.output_dir, verify)


if __name__ == "__main__":
    main()
