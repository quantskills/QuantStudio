#!/usr/bin/env python3
"""
每日复盘数据采集脚本 v3.0
=========================
数据来源: 新浪财经 (A股指数 + 国际市场)
输出: /tmp/daily_report_data.json

使用方式:
    python3 fetch_market_data.py
"""

import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    print(json.dumps({"error": "请安装 requests: pip3 install requests"}, ensure_ascii=False))
    sys.exit(1)

CST = timezone(timedelta(hours=8))
NOW = datetime.now(CST)
TODAY = NOW.strftime("%Y-%m-%d")
OUTPUT_PATH = "/tmp/daily_report_data.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/",
}


def safe_get(url, timeout=15, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            r.encoding = "gbk"
            return r
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
    return None


def try_float(v):
    if v is None: return None
    try: return float(v)
    except: return None


def parse_sina_fields(text):
    """解析新浪 hq_str 格式为 {symbol: [fields]}"""
    result = {}
    for m in re.finditer(r'var hq_str_([^=]+)="(.+?)"', text):
        sym = m.group(1)
        fields = m.group(2).split(",")
        result[sym] = fields
    return result


# ===================== A股指数 (新浪) =====================

def fetch_ashare_indices_sina():
    """
    新浪A股指数格式:
    s_sh000001 = "上证指数,当前价,涨跌额,涨跌幅%,成交量(手),成交额(元)"
    """
    url = "https://hq.sinajs.cn/list=s_sh000001,s_sz399001,s_sz399006,s_sh000688"
    r = safe_get(url)
    if not r:
        return {"error": "新浪A股指数请求失败"}

    parsed = parse_sina_fields(r.text)
    mapping = {
        "s_sh000001": ("上证指数", "000001"),
        "s_sz399001": ("深证成指", "399001"),
        "s_sz399006": ("创业板指", "399006"),
        "s_sh000688": ("科创50", "000688"),
    }

    results = []
    for sina_key, (name, code) in mapping.items():
        fields = parsed.get(sina_key)
        if fields and len(fields) >= 6:
            price = try_float(fields[1])
            change_amount = try_float(fields[2])
            change_pct = try_float(fields[3])
            volume = try_float(fields[4])   # 手
            amount = try_float(fields[5])    # 元
            results.append({
                "name": name,
                "code": code,
                "price": price,
                "change_pct": change_pct,
                "change_amount": change_amount,
                "volume": volume,
                "amount": amount,
            })
    return results if results else {"error": "新浪A股指数无数据"}


def fetch_ashare_volume():
    """获取沪深两市成交量"""
    url = "https://hq.sinajs.cn/list=s_sh000001,s_sz399001"
    r = safe_get(url)
    if not r:
        return {}

    parsed = parse_sina_fields(r.text)
    result = {}
    for sina_key, market_key in [("s_sh000001", "shanghai"), ("s_sz399001", "shenzhen")]:
        fields = parsed.get(sina_key)
        if fields and len(fields) >= 6:
            result[market_key] = {
                "name": fields[0],
                "price": try_float(fields[1]),
                "change_pct": try_float(fields[3]),
                "volume_hand": try_float(fields[4]),    # 成交量(手)
                "amount_yuan": try_float(fields[5]),     # 成交额(元)
            }
    return result


# ===================== 国际市场 (新浪) =====================

def fetch_sina_symbol(symbol):
    """获取单个新浪数据"""
    r = safe_get(f"https://hq.sinajs.cn/list={symbol}")
    if not r:
        return None
    return r.text


def parse_gb(text, expected_name):
    """解析美股 gb_ 格式"""
    m = re.search(r'var hq_str_gb_[^=]+="(.+?)"', text)
    if not m: return None
    f = m.group(1).split(",")
    if len(f) < 11: return None
    name = f[0]
    if expected_name and expected_name not in name:
        return None
    return {
        "name": name,
        "price": try_float(f[1]),
        "change_pct": try_float(f[2]),
        "change_amount": try_float(f[4]),
        "open": try_float(f[5]),
        "high": try_float(f[6]),
        "low": try_float(f[7]),
        "volume": try_float(f[10]),
    }


def parse_hf(text):
    """解析期货 hf_ 格式"""
    m = re.search(r'var hq_str_hf_[^=]+="(.+?)"', text)
    if not m: return None
    f = m.group(1).split(",")
    if len(f) < 14: return None

    price = try_float(f[3])
    prev_close = try_float(f[7])
    name = f[13] if len(f) > 13 else ""

    change_pct = None
    if price and prev_close and prev_close != 0:
        change_pct = round((price - prev_close) / prev_close * 100, 2)

    return {
        "name": name,
        "price": price,
        "prev_close": prev_close,
        "change_pct": change_pct,
        "open": try_float(f[2]),
        "high": try_float(f[4]),
        "low": try_float(f[5]),
        "volume": try_float(f[9]),
        "time": f[6],
        "date": f[12],
    }


def fetch_international_markets():
    """获取国际市场行情"""
    results = {}

    # 美股
    for sym, key, expected in [
        ("gb_$dji", "dow_jones", "道琼斯"),
        ("gb_ixic", "nasdaq", "纳斯达克"),
    ]:
        text = fetch_sina_symbol(sym)
        if text:
            data = parse_gb(text, expected)
            if data:
                data["symbol"] = "DJI" if key == "dow_jones" else "IXIC"
                data["market"] = "美股"
                results[key] = data

    # 标普500 - 从新浪的另一个接口尝试
    # gb_$spx 返回空，所以用WebSearch补充

    # 期货类
    for sym, key, expected, symbol, market in [
        ("hf_HSI", "hsi", "恒生", "HSI", "港股"),
        ("hf_NK", "nikkei", "日经", "NK225", "日股"),
        ("hf_GC", "gold", "黄金", "XAU", "黄金"),
        ("hf_CL", "crude_oil", "原油", "CL", "原油"),
    ]:
        text = fetch_sina_symbol(sym)
        if text:
            data = parse_hf(text)
            if data and expected in data.get("name", ""):
                data["symbol"] = symbol
                data["market"] = market
                results[key] = data

    return results


# ===================== 辅助 =====================

def get_market_status():
    wd = NOW.weekday()
    h, m = NOW.hour, NOW.minute
    if wd >= 5: return "周末休市"
    if (h == 9 and m >= 30) or (10 <= h < 11) or (h == 11 and m <= 30):
        return "A股交易中(上午)"
    elif (h == 11 and m > 30) or h == 12:
        return "A股午间休市"
    elif 13 <= h < 15 or (h == 15 and m <= 0):
        return "A股交易中(下午)"
    elif h >= 15:
        return "A股已收盘"
    return "A股未开盘"


# ===================== 主流程 =====================

def main():
    print(f"[{TODAY}] 开始采集市场数据...")

    data = {
        "report_date": TODAY,
        "fetch_time": NOW.strftime("%Y-%m-%d %H:%M:%S"),
        "market_status": get_market_status(),
        "data_source": {
            "ashare_indices": "新浪财经",
            "international": "新浪财经",
            "sectors": "需WebSearch补充",
            "capital_flow": "需WebSearch补充",
            "news": "需WebSearch/WebFetch补充",
        },
    }

    print("  → A股指数(新浪)...")
    data["ashare_indices"] = fetch_ashare_indices_sina()

    print("  → 成交概况...")
    data["market_summary"] = fetch_ashare_volume()

    print("  → 行业板块 → 需WebSearch补充")
    data["sectors"] = {}
    data["concept_sectors"] = {}

    print("  → 资金流向 → 需WebSearch补充")
    data["capital_flow"] = {}

    print("  → 国际市场...")
    data["international"] = fetch_international_markets()

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    idx_cnt = len(data["ashare_indices"]) if isinstance(data["ashare_indices"], list) else 0
    int_cnt = len(data["international"])

    print(f"\n✅ 数据已保存: {OUTPUT_PATH}")
    print(f"   A股指数: {idx_cnt} 个")
    print(f"   国际市场: {int_cnt} 个")
    print(f"   板块/资金/cls: 请运行 skill 后由 Claude 用 WebSearch 补充")

    print("\n=== A股指数 ===")
    if isinstance(data["ashare_indices"], list):
        for idx in data["ashare_indices"]:
            p = idx.get("change_pct")
            ps = f"{p:+.2f}%" if isinstance(p, (int, float)) else "N/A"
            print(f"  {idx['name']}: {idx.get('price','?')} ({ps})")

    print("\n=== 国际市场 ===")
    for key, val in data["international"].items():
        if isinstance(val, dict) and val.get("change_pct") is not None:
            print(f"  {val.get('name','')}({val.get('symbol','')}): {val['price']} ({val['change_pct']:+.2f}%)")


if __name__ == "__main__":
    main()
