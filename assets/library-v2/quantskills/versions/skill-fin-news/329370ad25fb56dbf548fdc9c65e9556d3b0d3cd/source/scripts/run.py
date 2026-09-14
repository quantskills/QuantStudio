"""
实时财经头条 · 数据采集器
============================
采集市场数据 + 多源财经新闻，供 AI 筛选并撰写深度分析。

数据来源: Pandadata API / 东方财富 / 新浪财经
用法:     python run.py
"""

import os, sys, io, re, time
from datetime import datetime, timedelta
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import pandas as pd
import requests
from bs4 import BeautifulSoup

# ══════════════════════════════════════════════════════
# 配置区
# ══════════════════════════════════════════════════════

PANDADATA_USERNAME = os.environ.get("DEFAULT_USERNAME")
PANDADATA_PASSWORD = os.environ.get("DEFAULT_PASSWORD")
PANDADATA_URL = os.environ.get("JAVA_SERVICE_BASE_URL", "http://pandadata.pandaaiquant.com")
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
NEWS_COUNT = 15
MAX_RETRIES = 2  # Pandadata API 重试次数

# 新闻源（按优先级）
NEWS_SOURCES = [
    {"name": "东方财富", "url": "https://finance.eastmoney.com/", "encoding": "utf-8", "type": "web"},
    {"name": "新浪财经", "url": "https://finance.sina.com.cn/", "encoding": "utf-8", "type": "web"},
    {"name": "华尔街见闻", "url": "https://api.wallstreetcn.com/apiv1/content/lives?channel=global-channel&limit=20", "encoding": "utf-8", "type": "api"},
]

# 跳过关键词
SKIP_KEYWORDS = [
    "投资日历", "四大证券报", "头版头条", "重要财经媒体",
    "三预警齐发", "台风", "牛散", "七年0薪",
    "上市公司重大事项公告",
]

# ❤️ 关注池 —— 这些关键词命中时，文章会标记 ★ 并排在前面
WATCH_KEYWORDS = [
    "芯片", "半导体", "AI", "人工智能", "大模型", "算力",
    "新能源", "储能", "碳达峰",
    "华为", "苹果", "特斯拉",
    "美联储", "加息",
    "长鑫", "中芯国际",
]

OUTPUT_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ══════════════════════════════════════════════════════
# 工具函数
# ══════════════════════════════════════════════════════

def retry(fn, max_tries=MAX_RETRIES, delay=2):
    """带重试的函数调用"""
    for attempt in range(max_tries):
        try:
            return fn()
        except Exception as e:
            if attempt < max_tries - 1:
                print(f"  [RETRY] 第{attempt+1}次失败: {e}，{delay}秒后重试...")
                time.sleep(delay)
            else:
                raise

# ══════════════════════════════════════════════════════
# Pandadata
# ══════════════════════════════════════════════════════

_PD = None

def pd_api():
    global _PD
    if _PD is None:
        if not PANDADATA_USERNAME or not PANDADATA_PASSWORD:
            print("\n  [ERROR] 请设置 Pandadata 凭证：")
            print("    export DEFAULT_USERNAME='your_username'")
            print("    export DEFAULT_PASSWORD='your_password'")
            print("    export JAVA_SERVICE_BASE_URL='http://pandadata.pandaaiquant.com'")
            raise SystemExit(1)
        import panda_data as _m
        _m.init_token(username=PANDADATA_USERNAME, password=PANDADATA_PASSWORD, base_url=PANDADATA_URL)
        _PD = _m
    return _PD

def collect_index_data():
    panda = pd_api()
    today = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")

    def _fetch():
        return panda.get_index_daily(
            symbol=["000001.SH", "399001.SZ", "399006.SZ", "000688.SH", "000300.SH"],
            start_date=start, end_date=today,
        )

    raw = retry(_fetch)
    if raw is None:
        return {}

    map = {"000001.SH": "上证指数", "399001.SZ": "深证成指", "399006.SZ": "创业板指", "000688.SH": "科创50", "000300.SH": "沪深300"}
    result = {}
    for sym, name in map.items():
        subset = raw[raw["symbol"] == sym]
        if subset.empty:
            continue
        cur = subset.iloc[0]
        prev = subset.iloc[1] if len(subset) > 1 else cur
        close = float(cur["close"])
        pre_close = float(
            cur["pre_close"] if "pre_close" in subset.columns and pd.notna(cur.get("pre_close"))
            else prev.get("close", close)
        )
        result[sym] = {"name": name, "close": close, "change_pct": (close / pre_close - 1) * 100, "amount": float(cur.get("amount", 0))}
    return result

def collect_margin_data():
    panda = pd_api()
    today = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")

    def _fetch():
        return panda.get_margin(start_date=start, end_date=today)

    try:
        raw = retry(_fetch)
        if raw is None or raw.empty:
            return None
        d = raw[raw["date"] == raw["date"].max()]
        return {"total": round(float(d["total_balance"].sum()) / 1e8, 0), "margin_balance": round(float(d["margin_balance"].sum()) / 1e8, 0), "short_balance": round(float(d["short_balance"].sum()) / 1e8, 0), "date": str(raw["date"].max())}
    except Exception as e:
        print(f"  [WARN] 融资融券: {e}")
        return None

def collect_macro_data():
    panda = pd_api()
    items = {}
    today = datetime.now().strftime("%Y%m%d")
    try:
        mb = panda.get_macro_mb(start_date="20250101", end_date=today)
        for symbol, key, fmt in [
            ("MB0000005", "m2", lambda v: f"{v/10000:.2f}万亿元"),
            ("MB0000003", "m1", lambda v: f"{v/10000:.2f}万亿元"),
            ("MB0000419", "forex_occupied", lambda v: f"{v:.0f}亿元"),
        ]:
            sub = mb[mb["symbol"] == symbol]
            if not sub.empty:
                lat = sub.iloc[-1]
                items[key] = {"value": float(lat["data_value"]), "date": str(lat["period_date"]), "display": fmt(float(lat["data_value"]))}
    except Exception as e:
        print(f"  [WARN] 宏观(MB): {e}")

    try:
        ir = panda.get_macro_ir(start_date=today, end_date=today)
        if ir.empty:
            ir = panda.get_macro_ir(start_date=(datetime.now() - timedelta(days=3)).strftime("%Y%m%d"), end_date=today)
        usd = ir[ir["symbol"] == "IR0000023"]
        if not usd.empty:
            lat = usd.iloc[-1]
            items["usdcny"] = {"value": float(lat["data_value"]), "date": str(lat["period_date"])}
    except Exception as e:
        print(f"  [WARN] USD/CNY: {e}")
    return items

# ══════════════════════════════════════════════════════
# 新闻采集（多源 + 智能去重）
# ══════════════════════════════════════════════════════

def fetch_news_from_source(source):
    """从单个新闻源抓取（支持 web 爬虫 和 API 两种模式）"""
    name, url, enc = source["name"], source["url"], source["encoding"]
    stype = source.get("type", "web")

    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.encoding = enc

        items = []

        if stype == "api":
            # JSON API 模式
            data = r.json()
            raw_items = data.get("data", {}).get("items", [])
            for item in raw_items:
                title = item.get("title", "") or ""
                # content_text 作为摘要
                content = item.get("content_text", "") or ""
                if not title:
                    # 有些快讯没有标题，取内容前40字
                    import re as _re
                    content_plain = _re.sub(r"<[^>]+>", "", content)[:40]
                    if content_plain:
                        title = content_plain
                if title and len(title) > 8:
                    items.append({"title": title.strip(), "url": url, "source": name, "summary": content[:300]})
        else:
            # Web 爬虫模式
            url_patterns = {
                "东方财富": lambda h: "finance.eastmoney.com/a/" in h and h.endswith(".html"),
                "新浪财经": lambda h: "finance.sina.com.cn" in h and h.endswith(".html"),
            }
            is_valid = url_patterns.get(name, lambda h: True)
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.find_all("a", href=True):
                text = a.get_text(strip=True)
                href = a["href"]
                if not text or len(text) <= 15 or not is_valid(href):
                    continue
                if any(kw in text for kw in SKIP_KEYWORDS):
                    continue
                items.append({"title": text.strip(), "url": href, "source": name})

        return items
    except Exception as e:
        print(f"  [WARN] {name} 抓取失败: {e}")
        return []

def deduplicate(items):
    """智能去重：按事件主题聚合，同一事件只保留最短标题"""
    # 用前20字做 key，但去掉「附股」「(名单)」等尾部干扰
    groups = {}
    for item in items:
        key = re.sub(r"[\(（].*?[\)）]", "", item["title"])[:20]
        groups.setdefault(key, []).append(item)

    result = []
    for key, group in groups.items():
        # 同组选标题最短的（通常是最核心的新闻，不是衍生版）
        best = min(group, key=lambda x: len(x["title"]))
        result.append(best)

    return result

def fetch_news():
    """从所有新闻源聚合"""
    all_items = []
    for source in NEWS_SOURCES:
        print(f"  [抓取] {source['name']}...")
        items = fetch_news_from_source(source)
        if items:
            print(f"    获得 {len(items)} 条")
            all_items.extend(items)
        else:
            print(f"    无数据")

    if not all_items:
        return []

    # 去重
    deduped = deduplicate(all_items)

    # 多源混合：按来源分组后交叉取
    source_buckets = {}
    for item in deduped:
        src = item.get("source", "其他")
        source_buckets.setdefault(src, []).append(item)

    # 确定各源配额：华尔街见闻至少4条，其余分配给东方财富
    ws_items = source_buckets.pop("华尔街见闻", [])
    east_items = source_buckets.pop("东方财富", [])
    other_items = []
    for v in source_buckets.values():
        other_items.extend(v)

    mixed = []
    # 华尔街见闻取前4条
    mixed.extend(ws_items[:4])
    # 东方财富填满剩余
    for item in east_items:
        if len(mixed) >= NEWS_COUNT:
            break
        if item["title"][:25] not in [x["title"][:25] for x in mixed]:
            mixed.append(item)
    # 还有空位就补其他源
    for item in other_items:
        if len(mixed) >= NEWS_COUNT:
            break
        mixed.append(item)

    # 关注池排序
    mixed.sort(key=lambda x: -sum(1 for kw in WATCH_KEYWORDS if kw in x["title"]))
    return mixed[:NEWS_COUNT]

# ── 文章摘要 ─────────────────────────────────────────

def fetch_summary(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        r.encoding = "utf-8"
        soup = BeautifulSoup(r.text, "html.parser")
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            t = meta["content"].strip()
            if len(t) > 20:
                return t[:300]
        for script in soup.find_all("script", type="application/ld+json"):
            import json
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    desc = data.get("description", "")
                    if desc and len(desc) > 20:
                        return desc[:300]
            except:
                pass
        return None
    except:
        return None

# ══════════════════════════════════════════════════════
# 报告生成
# ══════════════════════════════════════════════════════

def build_report(index_data, margin_data, macro_data, news_items):
    now = datetime.now()
    date_str = f"{now.year}.{now.month}.{now.day}"
    lines = []
    line = lines.append

    line("# 实时财经头条 · 采集数据")
    line(f"({date_str})")
    line("")

    # ── 市场数据 ──
    if index_data:
        parts = []
        for sym in ["000001.SH", "399001.SZ", "399006.SZ", "000688.SH"]:
            d = index_data.get(sym)
            if d:
                flag = "📈" if d["change_pct"] >= 0 else "📉"
                parts.append(f"{d['name']} {d['close']:.2f} {flag} **{abs(d['change_pct']):.2f}%**")
        if parts:
            line("> " + " | ".join(parts))
            line("")

        sh = index_data.get("000001.SH", {})
        sz = index_data.get("399001.SZ", {})
        total_amt = sh.get("amount", 0) + sz.get("amount", 0)
        hs = index_data.get("000300.SH", {})
        if hs:
            line(f"> **沪深300**: {hs.get('close', 'N/A')} ({hs.get('change_pct', 0):+.2f}%)  |  **两市成交额**: {total_amt/1e8:.0f}亿元")
        else:
            line(f"> **两市成交额**: {total_amt/1e8:.0f}亿元")
        line("")

    if margin_data:
        line(f"> **融资融券余额**: {margin_data['total']:.0f}亿元 (融资{margin_data['margin_balance']:.0f}亿 / 融券{margin_data['short_balance']:.0f}亿)  [{margin_data['date']}]")
        line("")

    if macro_data:
        m2 = macro_data.get("m2")
        if m2:
            line(f"> **M2**: {m2['display']} ({m2['date']})")
        fx = macro_data.get("usdcny")
        if fx:
            line(f"> **USD/CNY**: {fx['value']} ({fx['date']})")
        line("")

    # ── 新闻列表 ──
    if not news_items:
        line("*暂无新闻数据*")
    else:
        line("---")
        line("## 📰 今日要闻")
        line("")
        line(f"共 {len(news_items)} 条 | ★ 标记为关注池命中")
        line("")

        for idx, item in enumerate(news_items, 1):
            watch = " ★" if any(kw in item["title"] for kw in WATCH_KEYWORDS) else ""
            line(f"### {idx}.{watch} {item['title']}")
            line("")
            if "summary" in item and item["summary"]:
                line(f"> {item['summary']}")
                line("")
            line(f"  来源: {item.get('source', '东方财富')} | [链接]({item['url']})")
            line("")

    line("---")
    line(f"*生成时间: {now.strftime('%Y-%m-%d %H:%M:%S')}*")
    line("*数据来源: 东方财富 / 新浪财经 / Pandadata API*")
    line("*(仅供参考，不构成投资建议)*")

    return "\n".join(lines)

# ══════════════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  实时财经头条 · 数据采集器")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    index_data = {}
    margin_data = None
    macro_data = {}
    news_items = []

    # 1. 指数
    print("\n[1/4] 市场指数...", end="", flush=True)
    try:
        index_data = collect_index_data()
        print(f" OK  {len(index_data)} 个")
        for d in index_data.values():
            print(f"    {d['name']}: {d['close']:.2f} ({d['change_pct']:+.2f}%)")
    except Exception as e:
        print(f" FAIL  {e}")

    # 2. 融资融券
    print("[2/4] 融资融券...", end="", flush=True)
    try:
        margin_data = collect_margin_data()
        if margin_data:
            print(f" OK  {margin_data['total']:.0f}亿元")
        else:
            print(" --")
    except Exception as e:
        print(f" FAIL  {e}")

    # 3. 宏观
    print("[3/4] 宏观数据...", end="", flush=True)
    try:
        macro_data = collect_macro_data()
        print(f" OK  {len(macro_data)} 项")
        for v in macro_data.values():
            print(f"    {v.get('display', str(v['value']))} ({v['date']})")
    except Exception as e:
        print(f" FAIL  {e}")

    # 4. 新闻
    print("[4/4] 财经新闻...", flush=True)
    try:
        news_items = fetch_news()
        print(f"    共 {len(news_items)} 条")
        # 抓取摘要
        if news_items:
            print("    [+] 获取摘要...")
            for i, item in enumerate(news_items):
                if "summary" in item and item["summary"]:
                    continue  # API源已自带摘要
                summary = fetch_summary(item["url"])
                if summary:
                    item["summary"] = summary
    except Exception as e:
        print(f"    FAIL  {e}")

    # 生成
    print("\n生成 Markdown 报告...")
    report = build_report(index_data, margin_data, macro_data, news_items)

    date_str = datetime.now().strftime("%Y%m%d_%H%M")
    out_path = OUTPUT_DIR / f"实时财经头条_{date_str}.md"
    out_path.write_text(report, encoding="utf-8")
    print(f"已保存: {out_path.resolve()}")
    print()
    print(report)

    return report


if __name__ == "__main__":
    main()
