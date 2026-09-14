#!/usr/bin/env python3
"""
新闻采集器 — 采集 A 股财经新闻 + 市场背景快照。

职责: 只做数据采集，不做任何分析/提取。
  - AKShare 3源并行采集（东方财富/富途/同花顺）
  - 标题去重 + trade_date 时间过滤
  - PandaAI 市场快照（指数/北向/龙虎榜/板块）
  - 输出 JSON 供后续 AI 分析使用

用法:
    python scripts/collector.py --date 2026-07-09
    python scripts/collector.py --date 2026-07-09 --news-type all --max-news 30
"""

import argparse
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict, List, Optional, Callable
from urllib.parse import urlparse

import akshare as ak

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("collector")


# ── PandaAI 连接（内联） ────────────────────────────────────

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


def _panda_available() -> bool:
    _load_env()
    username = os.environ.get("PANDA_DATA_USERNAME", "").strip()
    password = os.environ.get("PANDA_DATA_PASSWORD", "").strip()
    if not username or not password:
        return False
    try:
        import panda_data
        panda_data.init_token(username=username, password=password)
        return True
    except Exception:
        return False


# ── 新闻采集 ────────────────────────────────────────────────

def _extract_source(url: str) -> str:
    domain_map = {
        "finance.eastmoney.com": "东方财富",
        "news.futunn.com": "富途牛牛",
        "news.10jqka.com.cn": "同花顺",
        "kuaixun.eastmoney.com": "东方财富",
    }
    try:
        return domain_map.get(urlparse(url).netloc, urlparse(url).netloc)
    except Exception:
        return "未知"


def _fetch_em() -> List[Dict]:
    rows = []
    try:
        df = ak.stock_info_global_em()
        for _, r in df.iterrows():
            rows.append({
                "title": str(r.get("标题", "") or ""),
                "content": str(r.get("摘要", "") or ""),
                "source": _extract_source(str(r.get("链接", "") or "")),
                "publish_time": str(r.get("发布时间", "") or ""),
            })
        logger.info(f"  东方财富  {len(df)} 条")
    except Exception as e:
        logger.warning(f"  东方财富 失败: {e}")
    return rows


def _fetch_futu() -> List[Dict]:
    rows = []
    try:
        df = ak.stock_info_global_futu()
        for _, r in df.iterrows():
            rows.append({
                "title": str(r.get("标题", "") or ""),
                "content": str(r.get("内容", "") or ""),
                "source": _extract_source(str(r.get("链接", "") or "")),
                "publish_time": str(r.get("发布时间", "") or ""),
            })
        logger.info(f"  富途牛牛  {len(df)} 条")
    except Exception as e:
        logger.warning(f"  富途牛牛 失败: {e}")
    return rows


def _fetch_ths() -> List[Dict]:
    rows = []
    try:
        df = ak.stock_info_global_ths()
        for _, r in df.iterrows():
            rows.append({
                "title": str(r.get("标题", "") or ""),
                "content": str(r.get("内容", "") or ""),
                "source": _extract_source(str(r.get("链接", "") or "")),
                "publish_time": str(r.get("发布时间", "") or ""),
            })
        logger.info(f"  同花顺    {len(df)} 条")
    except Exception as e:
        logger.warning(f"  同花顺   失败: {e}")
    return rows


def _parse_time(pub: str, cutoff: datetime) -> bool:
    if not pub:
        return True
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try:
            return datetime.strptime(pub, fmt) <= cutoff
        except ValueError:
            continue
    return True


def collect_news(news_type: str = "all",
                 max_news_count: int = 50,
                 trade_date: Optional[str] = None) -> List[Dict]:
    """采集新闻 — AKShare 3源并行 + 去重 + 时间过滤"""
    seen_titles = set()
    all_news = []

    def _add(item: Dict):
        t = item.get("title", "")
        if not t or t in seen_titles:
            return
        seen_titles.add(t)
        all_news.append(item)

    fetchers: List[Callable] = [_fetch_em, _fetch_futu, _fetch_ths]
    with ThreadPoolExecutor(max_workers=3) as ex:
        fs = {ex.submit(f): f.__name__ for f in fetchers}
        for f in as_completed(fs):
            for item in f.result():
                _add(item)

    logger.info(f"  原始总计  {len(all_news)} 条")

    if trade_date:
        cutoff = datetime.strptime(trade_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59
        )
        before = len(all_news)
        all_news = [n for n in all_news if _parse_time(n.get("publish_time", ""), cutoff)]
        dropped = before - len(all_news)
        if dropped:
            logger.info(f"  时间过滤 -{dropped} 条")

    all_news = all_news[:max_news_count]
    return all_news


# ── 市场背景 ────────────────────────────────────────────────

def collect_market_context(trade_date: str) -> Dict:
    """采集当日市场背景（PandaAI + AKShare 板块）"""
    ctx = {
        "indices": {},
        "northbound": None,
        "lhb_count": 0,
        "top_sectors": [],
    }

    pa = _panda_available()

    if pa:
        import panda_data as pd_mod
        try:
            df = pd_mod.get_index_daily(
                symbol="000001.SH",
                start_date=trade_date.replace("-", ""),
                end_date=trade_date.replace("-", ""),
            )
            if df is not None and not (hasattr(df, "empty") and df.empty):
                r = df.iloc[-1]
                ctx["indices"]["sh"] = {
                    "close": float(r.get("close", 0)),
                    "pct": float(r.get("pct_change", 0)),
                }
        except Exception:
            pass
        try:
            df = pd_mod.get_index_daily(
                symbol="399006.SZ",
                start_date=trade_date.replace("-", ""),
                end_date=trade_date.replace("-", ""),
            )
            if df is not None and not (hasattr(df, "empty") and df.empty):
                r = df.iloc[-1]
                ctx["indices"]["cy"] = {
                    "close": float(r.get("close", 0)),
                    "pct": float(r.get("pct_change", 0)),
                }
        except Exception:
            pass
        try:
            nb = pd_mod.get_hsgt_hold(
                start_date=trade_date.replace("-", ""),
                end_date=trade_date.replace("-", ""),
            )
            ctx["northbound"] = (
                len(nb)
                if nb is not None and not (hasattr(nb, "empty") and nb.empty)
                else 0
            )
        except Exception:
            pass
        try:
            lhb = pd_mod.get_lhb_list(
                start_date=trade_date.replace("-", ""),
                end_date=trade_date.replace("-", ""),
            )
            ctx["lhb_count"] = (
                len(lhb)
                if lhb is not None and not (hasattr(lhb, "empty") and lhb.empty)
                else 0
            )
        except Exception:
            pass
    else:
        try:
            df = ak.stock_zh_index_daily_em(symbol="sh000001")
            if not df.empty:
                r = df.iloc[-1]
                ctx["indices"]["sh"] = {
                    "close": float(r.get("close", 0)),
                    "pct": float(r.get("涨跌幅", 0)),
                }
        except Exception:
            pass
        try:
            df = ak.stock_zh_index_daily_em(symbol="sz399006")
            if not df.empty:
                r = df.iloc[-1]
                ctx["indices"]["cy"] = {
                    "close": float(r.get("close", 0)),
                    "pct": float(r.get("涨跌幅", 0)),
                }
        except Exception:
            pass

    try:
        df = ak.stock_board_industry_name_em()
        if not df.empty:
            ctx["top_sectors"] = [
                {"name": str(r.get("板块名称", "")), "pct": float(r.get("涨跌幅", 0))}
                for _, r in df.head(5).iterrows()
            ]
    except Exception:
        pass

    return ctx


# ── CLI ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="新闻采集器")
    parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"))
    parser.add_argument("--news-type", default="all", choices=["macro", "company", "all"])
    parser.add_argument("--max-news", type=int, default=50)
    parser.add_argument("--output", default=None, help="JSON 输出路径")
    args = parser.parse_args()

    news_list = collect_news(args.news_type, args.max_news, args.date)
    market = collect_market_context(args.date)

    result = {
        "trade_date": args.date,
        "news_count": len(news_list),
        "news": news_list,
        "market_context": market,
        "pandaai_available": _panda_available(),
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    output = json.dumps(result, ensure_ascii=False, indent=2, default=str)

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"\n  ✅ 已保存到 {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
