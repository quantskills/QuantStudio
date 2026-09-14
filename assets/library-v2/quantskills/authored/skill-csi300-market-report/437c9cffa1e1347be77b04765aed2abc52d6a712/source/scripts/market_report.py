#!/usr/bin/env python3
"""
沪深300市场日报/周报 · 数据采集与报告生成器
================================================
通过 PandaData SDK 获取沪深300指数行情、成分股权重、行业分布、
估值数据，输出结构化 Markdown 分析报告。

用法:
    python market_report.py --date 20250912 --mode daily --out-dir ../output

依赖:
    Python 3.10+, panda_data, pandas
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shlex
import sys
import traceback
from pathlib import Path
from typing import Any

import pandas as pd


# ──────────────────────────────────────────────
# 常量配置
# ──────────────────────────────────────────────

CSI300_SYMBOL = "000300.SH"
DEFAULT_BASE_URL = "http://pandadata.pandaaiquant.com"
DEFAULT_ENV_FILE = Path.home() / ".pandadata" / "pandadata.env"

# 报告包含的子板块开关
SECTIONS = [
    "overview",        # 一、指数概览
    "industry",        # 二、行业板块表现
    "top_stocks",      # 三、成分股 TOP 榜单
    "trend",           # 四、近期走势
    "breadth",         # 五、市场广度
    "focus",           # 六、重点关注分析
]

SW_2021_L1_CODES = [
    "601010", "601011", "601012", "601013", "601014", "601015",
    "601016", "601017", "601018", "601019", "601020", "601021",
    "601022", "601023", "601024", "601025", "601026", "601027",
    "601028", "601029", "601030", "601031", "601032",
]
"""暂存常用一级行业代码，实际使用中通过 get_industry_detail 动态获取。"""


# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────

def parse_env_assignment(line: str) -> tuple[str, str] | None:
    """解析 .env 文件中的 export KEY=VALUE 行。"""
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    try:
        parts = shlex.split(stripped, posix=True)
    except ValueError:
        return None
    if not parts:
        return None
    if parts[0] == "export":
        parts = parts[1:]
    if not parts or "=" not in parts[0]:
        return None
    key, value = parts[0].split("=", 1)
    key = key.strip()
    if not key:
        return None
    return key, value


def load_env_file(path: Path, override: bool = False) -> bool:
    """加载 .env 文件到 os.environ。"""
    if not path.exists():
        return False
    for line in path.read_text(encoding="utf-8").splitlines():
        parsed = parse_env_assignment(line)
        if not parsed:
            continue
        key, value = parsed
        if override or key not in os.environ:
            os.environ[key] = value
    return True


def credentials_from_env() -> tuple[str, str, str]:
    return (
        os.getenv("DEFAULT_USERNAME", ""),
        os.getenv("DEFAULT_PASSWORD", ""),
        os.getenv("JAVA_SERVICE_BASE_URL", DEFAULT_BASE_URL),
    )


def init_pandadata(env_file: Path):
    """初始化 PandaData SDK。返回 (panda_data_module, base_url)。"""
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10+ required for panda_data SDK.")

    try:
        import panda_data  # noqa: PLC0415
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            f"panda_data SDK 未安装: {exc.name}. 请运行: pip install panda-data"
        ) from exc

    load_env_file(env_file)
    username, password, base_url = credentials_from_env()
    if not username or not password or not base_url:
        raise RuntimeError(
            "缺少 PandaData 凭据。请设置 DEFAULT_USERNAME / DEFAULT_PASSWORD / "
            "JAVA_SERVICE_BASE_URL 环境变量或创建 ~/.pandadata/pandadata.env 文件。"
        )

    try:
        panda_data.init_token(username=username, password=password, base_url=base_url)
    except Exception as exc:
        raise RuntimeError(f"PandaData 登录失败: {exc}") from exc

    return panda_data, base_url


def safe_get(pd_mod, method: str, **kwargs) -> list[dict[str, Any]]:
    """调用 PandaData get_* 方法，返回 data 列表，失败时返回空列表。"""
    func = getattr(pd_mod, method, None)
    if func is None:
        print(f"  [WARN] PandaData 无方法: {method}", file=sys.stderr)
        return []
    try:
        result = func(**kwargs)
        data = result.get("data") if isinstance(result, dict) else result
        if isinstance(data, list):
            return data
        if isinstance(data, pd.DataFrame):
            return data.to_dict("records")
        return []
    except Exception as exc:
        print(f"  [WARN] {method} 调用失败: {exc}", file=sys.stderr)
        return []


def find_last_trading_day(pd_mod, reference: dt.date) -> dt.date:
    """从 reference 向前找到第一个有数据的交易日（最多回退 10 天）。"""
    for offset in range(10):
        candidate = reference - dt.timedelta(days=offset)
        # 跳过周末
        if candidate.weekday() >= 5:
            continue
        data = safe_get(
            pd_mod, "get_index_daily",
            symbol=CSI300_SYMBOL,
            start_date=candidate.strftime("%Y%m%d"),
            end_date=candidate.strftime("%Y%m%d"),
        )
        if data:
            return candidate
    return reference


def trading_dates_range(pd_mod, end: dt.date, count: int) -> list[dt.date]:
    """从 end 向前取 count 个交易日（含 end），返回升序列表。"""
    dates: list[dt.date] = []
    cursor = end
    while len(dates) < count:
        if cursor.weekday() < 5:
            data = safe_get(
                pd_mod, "get_index_daily",
                symbol=CSI300_SYMBOL,
                start_date=cursor.strftime("%Y%m%d"),
                end_date=cursor.strftime("%Y%m%d"),
            )
            if data:
                dates.append(cursor)
        cursor -= dt.timedelta(days=1)
        # 安全阀
        if cursor < end - dt.timedelta(days=count * 3):
            break
    dates.sort()
    return dates


# ──────────────────────────────────────────────
# 数据采集
# ──────────────────────────────────────────────

def fetch_index_daily(pd_mod, start_date: str, end_date: str) -> list[dict]:
    """获取沪深300指数日线数据。"""
    return safe_get(
        pd_mod, "get_index_daily",
        symbol=CSI300_SYMBOL,
        start_date=start_date,
        end_date=end_date,
        fields="date,symbol,open,close,high,low,volume,amount,pre_close",
    )


def fetch_index_indicator(pd_mod, start_date: str, end_date: str) -> list[dict]:
    """获取沪深300指数估值指标。"""
    return safe_get(
        pd_mod, "get_index_indicator",
        symbol=CSI300_SYMBOL,
        start_date=start_date,
        end_date=end_date,
    )


def fetch_index_weights(pd_mod, date_str: str) -> list[dict]:
    """获取沪深300指数成分股权重（单个交易日）。"""
    return safe_get(
        pd_mod, "get_index_weights",
        index_symbol=CSI300_SYMBOL,
        start_date=date_str,
        end_date=date_str,
    )


def fetch_stock_detail(pd_mod, symbols: list[str]) -> dict[str, str]:
    """获取股票名称映射。返回 {symbol: name}。"""
    data = safe_get(
        pd_mod, "get_stock_detail",
        symbol=symbols,
        fields="symbol,name",
    )
    return {item["symbol"]: item.get("name", "") for item in data}


def fetch_stock_industry(pd_mod, symbols: list[str]) -> dict[str, dict]:
    """批量获取股票所属申万一级行业。
    返回 {symbol: {"l1_code": ..., "l1_name": ...}}。
    """
    result: dict[str, dict] = {}
    # 分批查询，避免单次请求过大
    batch_size = 20
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i + batch_size]
        for sym in batch:
            data = safe_get(
                pd_mod, "get_stock_industry",
                stock_symbol=sym,
                level="L1",
                reference="sws_2021",
            )
            if data:
                result[sym] = {
                    "l1_code": data[0].get("industry_code", ""),
                    "l1_name": data[0].get("industry_name", ""),
                }
    return result


# ──────────────────────────────────────────────
# 计算与分析
# ──────────────────────────────────────────────

def calc_change_rate(current: float, prev: float) -> float | None:
    """计算涨跌幅(%)。"""
    if prev and prev != 0:
        return round((current - prev) / prev * 100, 2)
    return None


def compute_single_day_overview(
    daily_data: list[dict],
    indicator_data: list[dict],
) -> dict[str, Any]:
    """从日线数据中提取单日概览指标。"""
    if not daily_data:
        return {"error": "无日线数据"}
    row = daily_data[-1]
    close_val = row.get("close", 0)
    pre_close = row.get("pre_close", 0)
    change_rate = calc_change_rate(close_val, pre_close)
    overview = {
        "date": row.get("date", ""),
        "close": close_val,
        "open": row.get("open", 0),
        "high": row.get("high", 0),
        "low": row.get("low", 0),
        "change_rate": change_rate,
        "amplitude": round(((row.get("high", 0) - row.get("low", 0)) / pre_close * 100), 2) if pre_close else None,
        "volume": row.get("volume", 0),
        "amount": round(row.get("amount", 0) / 1e8, 2),  # 亿元
    }
    if indicator_data:
        indicator = indicator_data[-1]
        overview["pe_ttm"] = indicator.get("pe_ttm")
        overview["pb_lf"] = indicator.get("pb_lf")
    return overview


def compute_weekly_overview(
    daily_data: list[dict],
    indicator_data: list[dict],
) -> dict[str, Any]:
    """从一周日线数据中提取周度概览指标。"""
    if not daily_data:
        return {"error": "无周线数据"}
    first = daily_data[0]
    last = daily_data[-1]
    first_pre_close = first.get("pre_close", 0) or first.get("close", 0)
    weekly_change = calc_change_rate(last.get("close", 0), first_pre_close)
    weekly_amount = round(sum(r.get("amount", 0) for r in daily_data) / 1e8, 2)

    overview = {
        "date": last.get("date", ""),
        "close": last.get("close", 0),
        "week_open": first.get("open", 0),
        "week_high": max(r.get("high", 0) for r in daily_data),
        "week_low": min(r.get("low", 0) for r in daily_data),
        "change_rate": weekly_change,
        "amount": weekly_amount,
    }
    if indicator_data:
        indicator = indicator_data[-1]
        overview["pe_ttm"] = indicator.get("pe_ttm")
        overview["pb_lf"] = indicator.get("pb_lf")
    return overview


def compute_industry_summary(
    weights: list[dict],
    industry_map: dict[str, dict],
    stock_names: dict[str, str],
    stock_prices: dict[str, dict],
) -> dict[str, Any]:
    """按申万一级行业汇总成分股表现。
    
    Returns:
        {"industries": [...], "stock_rank_up": [...], "stock_rank_down": [...]}
    """
    # 构建 {symbol: weight} 映射
    weight_map: dict[str, float] = {}
    for w in weights:
        sym = w.get("stock_symbol", "")
        weight = w.get("weight", 0)
        weight_map[sym] = weight

    # 合并行业信息
    stock_info: dict[str, dict] = {}
    for sym, wt in weight_map.items():
        ind = industry_map.get(sym, {"l1_code": "", "l1_name": "未分类"})
        price_info = stock_prices.get(sym, {})
        change = price_info.get("change_rate")
        stock_info[sym] = {
            "symbol": sym,
            "name": stock_names.get(sym, sym),
            "weight": wt,
            "industry": ind.get("l1_name", "未分类"),
            "change_rate": change,
            "contribution": round((wt * (change or 0) / 100), 4) if change is not None else None,
        }

    # 按行业汇总
    industry_groups: dict[str, dict] = {}
    for sym, info in stock_info.items():
        ind_name = info["industry"]
        if ind_name not in industry_groups:
            industry_groups[ind_name] = {
                "industry": ind_name,
                "total_weight": 0,
                "up_count": 0,
                "down_count": 0,
                "flat_count": 0,
                "changes": [],
                "contributions": [],
            }
        grp = industry_groups[ind_name]
        grp["total_weight"] += info["weight"]
        if info["change_rate"] is not None:
            grp["changes"].append(info["change_rate"])
            if info["change_rate"] > 0:
                grp["up_count"] += 1
            elif info["change_rate"] < 0:
                grp["down_count"] += 1
            else:
                grp["flat_count"] += 1
        if info["contribution"] is not None:
            grp["contributions"].append(info["contribution"])

    industries = []
    for ind_name, grp in industry_groups.items():
        avg_change = round(sum(grp["changes"]) / len(grp["changes"]), 2) if grp["changes"] else 0
        total_contrib = round(sum(grp["contributions"]) * 100, 3) if grp["contributions"] else 0
        industries.append({
            "industry": ind_name,
            "up_count": grp["up_count"],
            "down_count": grp["down_count"],
            "total_count": len(grp["changes"]),
            "avg_change": avg_change,
            "weight_pct": round(grp["total_weight"], 2),
            "contribution": total_contrib,
        })

    industries.sort(key=lambda x: x["avg_change"], reverse=True)

    # 个股涨跌排名
    stocks_with_change = [
        s for s in stock_info.values()
        if s["change_rate"] is not None
    ]
    top_up = sorted(stocks_with_change, key=lambda x: x["change_rate"], reverse=True)[:10]
    top_down = sorted(stocks_with_change, key=lambda x: x["change_rate"])[:10]
    top_contrib = sorted(
        [s for s in stock_info.values() if s["contribution"] is not None],
        key=lambda x: abs(x["contribution"]),
        reverse=True,
    )[:5]

    return {
        "industries": industries,
        "stock_rank_up": top_up,
        "stock_rank_down": top_down,
        "stock_rank_contrib": top_contrib,
    }


# ──────────────────────────────────────────────
# Markdown 报告生成
# ──────────────────────────────────────────────

def render_md_report(
    mode: str,
    overview: dict,
    industry_summary: dict | None,
    trend_data: list[dict],
    broad_data: dict,
    focus_text: str,
) -> str:
    """渲染完整 Markdown 报告。"""
    lines: list[str] = []
    report_date = overview.get("date", "")

    # 标题
    mode_label = "日报" if mode == "daily" else "周报"
    lines.append(f"# 沪深300市场{mode_label} | {report_date}")
    lines.append("")

    # ─── 一、指数概览 ───
    lines.append("## 一、指数概览")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    if mode == "daily":
        lines.append(f"| 收盘价 | {overview.get('close', 'N/A')} |")
        if overview.get("change_rate") is not None:
            sign = "+" if overview["change_rate"] >= 0 else ""
            lines.append(f"| 涨跌幅 | {sign}{overview['change_rate']}% |")
        else:
            lines.append("| 涨跌幅 | N/A |")
        lines.append(f"| 成交额（亿元） | {overview.get('amount', 'N/A')} |")
        lines.append(f"| 振幅 | {overview.get('amplitude', 'N/A')}% |")
    else:
        lines.append(f"| 周收盘价 | {overview.get('close', 'N/A')} |")
        if overview.get("change_rate") is not None:
            sign = "+" if overview["change_rate"] >= 0 else ""
            lines.append(f"| 周涨跌幅 | {sign}{overview['change_rate']}% |")
        else:
            lines.append("| 周涨跌幅 | N/A |")
        lines.append(f"| 周成交额（亿元） | {overview.get('amount', 'N/A')} |")
    if overview.get("pe_ttm") is not None:
        lines.append(f"| PE(TTM) | {overview['pe_ttm']} |")
    if overview.get("pb_lf") is not None:
        lines.append(f"| PB(LF) | {overview['pb_lf']} |")
    lines.append("| 数据来源 | get_index_daily / get_index_indicator |")
    lines.append("")

    # ─── 二、行业板块表现 ───
    lines.append("## 二、行业板块表现（申万一级）")
    lines.append("")
    if industry_summary and industry_summary.get("industries"):
        lines.append("| 行业 | 涨跌家数比 | 平均涨跌幅 | 权重占比(%) | 指数贡献度(%) |")
        lines.append("|------|-----------|-----------|------------|--------------|")
        for ind in industry_summary["industries"][:20]:  # 最多展示 20 个行业
            ratio = f"{ind['up_count']}/{ind['down_count']}"
            avg_c = f"{ind['avg_change']:+.2f}%"
            lines.append(
                f"| {ind['industry']} | {ratio} | {avg_c} "
                f"| {ind['weight_pct']} | {ind['contribution']:+.3f} |"
            )
    else:
        lines.append("（行业数据未获取或配额不足）")
    lines.append("")

    # ─── 三、成分股 TOP 榜单 ───
    lines.append("## 三、成分股 TOP 榜单")
    lines.append("")

    if industry_summary:
        # 涨幅 TOP 10
        lines.append("### 涨幅 TOP 10")
        lines.append("")
        lines.append("| 排名 | 代码 | 名称 | 行业 | 涨跌幅(%) | 权重(%) |")
        lines.append("|------|------|------|------|----------|--------|")
        for rank, s in enumerate(industry_summary.get("stock_rank_up", []), 1):
            change_str = f"{s['change_rate']:+.2f}" if s['change_rate'] is not None else "N/A"
            lines.append(
                f"| {rank} | {s['symbol']} | {s['name']} | {s['industry']} "
                f"| {change_str} | {s['weight']} |"
            )
        lines.append("")

        # 跌幅 TOP 10
        lines.append("### 跌幅 TOP 10")
        lines.append("")
        lines.append("| 排名 | 代码 | 名称 | 行业 | 涨跌幅(%) | 权重(%) |")
        lines.append("|------|------|------|------|----------|--------|")
        for rank, s in enumerate(industry_summary.get("stock_rank_down", []), 1):
            change_str = f"{s['change_rate']:+.2f}" if s['change_rate'] is not None else "N/A"
            lines.append(
                f"| {rank} | {s['symbol']} | {s['name']} | {s['industry']} "
                f"| {change_str} | {s['weight']} |"
            )
        lines.append("")

        # 权重贡献 TOP 5
        lines.append("### 权重贡献 TOP 5")
        lines.append("")
        lines.append("| 排名 | 代码 | 名称 | 行业 | 权重(%) | 贡献度(%) |")
        lines.append("|------|------|------|------|--------|----------|")
        for rank, s in enumerate(industry_summary.get("stock_rank_contrib", []), 1):
            contrib_str = f"{s['contribution']:+.4f}" if s['contribution'] is not None else "N/A"
            lines.append(
                f"| {rank} | {s['symbol']} | {s['name']} | {s['industry']} "
                f"| {s['weight']} | {contrib_str} |"
            )
        lines.append("")
    else:
        lines.append("（成分股数据未获取）")
        lines.append("")

    # ─── 四、近期走势 ───
    lines.append("## 四、近期走势")
    lines.append("")
    if trend_data:
        lines.append("| 周期 | 涨跌幅(%) | 日均成交额(亿元) |")
        lines.append("|------|----------|----------------|")
        for td in trend_data:
            lines.append(
                f"| {td['label']} | {td['change']:+.2f} | {td['avg_amount']} |"
            )
    else:
        lines.append("（近期走势数据未获取）")
    lines.append("")

    # ─── 五、市场广度 (仅日报) ───
    if mode == "daily":
        lines.append("## 五、市场广度")
        lines.append("")
        if broad_data:
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            if "up_count" in broad_data:
                lines.append(f"| 上涨家数 / 总成分股 | {broad_data['up_count']} / {broad_data.get('total_count', 0)} |")
                lines.append(f"| 上涨占比 | {broad_data.get('up_ratio', 0)}% |")
            if "amount_change_vs_prev" in broad_data:
                lines.append(f"| 成交额较前日 | {broad_data['amount_change_vs_prev']:+.2f}% |")
            if "amount_change_vs_20d" in broad_data:
                lines.append(f"| 成交额较20日均值 | {broad_data['amount_change_vs_20d']:+.2f}% |")
        else:
            lines.append("（市场广度数据未获取）")
        lines.append("")

    # ─── 六、重点关注分析 ───
    if focus_text:
        lines.append("## 六、重点关注分析")
        lines.append("")
        lines.append(focus_text)
        lines.append("")

    # 脚注
    lines.append("---")
    lines.append("")
    lines.append("*报告由沪深300市场日报/周报 Skill 自动生成*")
    lines.append("*数据来源：PandaData*")
    lines.append("*本报告基于公开数据与规则化分析生成，仅供研究参考，不构成任何投资建议。*")
    lines.append("")

    return "\n".join(lines)


# ──────────────────────────────────────────────
# 主流程
# ──────────────────────────────────────────────

def run(args: argparse.Namespace) -> int:
    """主入口。返回 0 表示成功，非 0 表示失败。"""
    out_dir = Path(args.out_dir) if args.out_dir else Path.cwd() / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. 初始化 PandaData
    env_file = Path(args.env_file) if args.env_file else DEFAULT_ENV_FILE
    try:
        pd_mod, base_url = init_pandadata(env_file)
    except RuntimeError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    # 2. 确定日期
    if args.date:
        ref_date = dt.datetime.strptime(args.date, "%Y%m%d").date()
    else:
        ref_date = dt.date.today()
    trade_date = find_last_trading_day(pd_mod, ref_date)
    print(f"[INFO] 参考日期: {ref_date} → 实际交易日: {trade_date}")
    date_str = trade_date.strftime("%Y%m%d")

    mode = args.mode or "daily"

    # 3. 获取指数日线数据
    if mode == "daily":
        daily_data = fetch_index_daily(pd_mod, date_str, date_str)
    else:
        week_start = trade_date - dt.timedelta(days=6)
        weekly_data = fetch_index_daily(
            pd_mod, week_start.strftime("%Y%m%d"), date_str
        )
        # 按周过滤：只保留自然周内的交易日（周一到周五）
        daily_data = [
            r for r in weekly_data
            if dt.datetime.strptime(r["date"], "%Y%m%d").weekday() < 5
        ]

    if not daily_data:
        print(f"[ERROR] 未获取到指数日线数据（{date_str}）", file=sys.stderr)
        return 1

    # 4. 获取估值指标
    indicator_start = (trade_date - dt.timedelta(days=10)).strftime("%Y%m%d")
    indicator_data = fetch_index_indicator(pd_mod, indicator_start, date_str)

    # 5. 获取成分股权重
    weights = fetch_index_weights(pd_mod, date_str)

    # 6. 获取股票详情
    if weights:
        symbols = list({w.get("stock_symbol", "") for w in weights if w.get("stock_symbol")})
        stock_names = fetch_stock_detail(pd_mod, symbols[:100])  # 最多查 100 只名称
        # 获取行业分类（权重前 50）
        top_symbols = sorted(weights, key=lambda w: w.get("weight", 0), reverse=True)[:50]
        top_symbols_list = [w["stock_symbol"] for w in top_symbols if w.get("stock_symbol")]
        industry_map = fetch_stock_industry(pd_mod, top_symbols_list)
    else:
        print("[WARN] 未获取到成分股权重数据，将仅生成指数概览。", file=sys.stderr)
        stock_names = {}
        industry_map = {}
        top_symbols_list = []

    # 7. 计算概览
    if mode == "daily":
        overview = compute_single_day_overview(daily_data, indicator_data)
    else:
        overview = compute_weekly_overview(daily_data, indicator_data)

    # 8. 计算行业和个股排名（日报模式才有成分股价格变动）
    industry_summary = None
    # 对于日报，获取当日成分股行情
    stock_prices: dict[str, dict] = {}
    if mode == "daily" and top_symbols_list:
        # 这里用 get_stock_daily 获取成分股行情简表
        # 注意：实际调用时受配额限制，优先查询权重前 30
        price_query_symbols = top_symbols_list[:30]
        price_data = safe_get(
            pd_mod, "get_stock_daily",
            symbol=price_query_symbols,
            start_date=date_str,
            end_date=date_str,
            fields="symbol,close,pre_close",
        )
        for p in price_data:
            sym = p.get("symbol", "")
            pre_close = p.get("pre_close", 0)
            close_val = p.get("close", 0)
            stock_prices[sym] = {
                "close": close_val,
                "pre_close": pre_close,
                "change_rate": calc_change_rate(close_val, pre_close),
            }
        industry_summary = compute_industry_summary(
            weights, industry_map, stock_names, stock_prices,
        )

    # 9. 近期走势趋势
    trend_data: list[dict] = []
    import copy
    periods = [
        ("近 5 日", trade_date, 5),
        ("近 20 日", trade_date, 20),
        ("近 60 日", trade_date, 60),
    ]
    for label, end, count in periods:
        dates = trading_dates_range(pd_mod, end, count)
        if len(dates) >= 2:
            start = dates[0]
            end_d = dates[-1]
            segment = fetch_index_daily(
                pd_mod,
                start.strftime("%Y%m%d"),
                end_d.strftime("%Y%m%d"),
            )
            if segment and len(segment) >= 2:
                first_close = segment[0].get("pre_close", 0) or segment[0].get("close", 0)
                last_close = segment[-1].get("close", 0)
                change_val = calc_change_rate(last_close, first_close)
                avg_amt = round(
                    sum(r.get("amount", 0) for r in segment) / len(segment) / 1e8, 2
                )
                trend_data.append({
                    "label": label,
                    "change": change_val or 0,
                    "avg_amount": avg_amt,
                })

    # 10. 市场广度（日报）
    broad_data: dict[str, Any] = {}
    if mode == "daily" and industry_summary:
        total = sum(
            ind["up_count"] + ind["down_count"]
            for ind in industry_summary.get("industries", [])
        )
        ups = sum(ind["up_count"] for ind in industry_summary.get("industries", []))
        broad_data["up_count"] = ups
        broad_data["total_count"] = total
        broad_data["up_ratio"] = round(ups / total * 100, 1) if total else 0

        # 成交额变化
        curr_amount = overview.get("amount", 0)
        prev_day = trade_date - dt.timedelta(days=1)
        prev_date = find_last_trading_day(pd_mod, prev_day)
        prev_data = fetch_index_daily(
            pd_mod,
            prev_date.strftime("%Y%m%d"),
            prev_date.strftime("%Y%m%d"),
        )
        if prev_data:
            prev_amount = prev_data[0].get("amount", 0) / 1e8
            broad_data["amount_change_vs_prev"] = calc_change_rate(
                curr_amount * 1e8, prev_amount * 1e8
            ) if prev_amount else 0

        # 20日均成交额
        dates_20d = trading_dates_range(pd_mod, trade_date, 20)
        if len(dates_20d) >= 2:
            seg = fetch_index_daily(
                pd_mod,
                dates_20d[0].strftime("%Y%m%d"),
                dates_20d[-1].strftime("%Y%m%d"),
            )
            if seg:
                avg_20d = sum(r.get("amount", 0) for r in seg) / len(seg) / 1e8
                broad_data["amount_change_vs_20d"] = calc_change_rate(
                    curr_amount * 1e8, avg_20d * 1e8
                ) if avg_20d else 0

    # 11. 生成 Markdown 报告
    md = render_md_report(
        mode=mode,
        overview=overview,
        industry_summary=industry_summary,
        trend_data=trend_data,
        broad_data=broad_data,
        focus_text=args.focus or "",
    )

    # 12. 保存输出
    report_name = f"csi300_{mode}_report_{date_str}.md"
    report_path = out_dir / report_name
    report_path.write_text(md, encoding="utf-8")
    print(f"[OK] 报告已保存: {report_path}")

    # 输出 JSON 摘要（供 AI agent 参考）
    summary = {
        "report_file": str(report_path),
        "trade_date": date_str,
        "mode": mode,
        "close": overview.get("close"),
        "change_rate": overview.get("change_rate"),
        "amount_yi": overview.get("amount"),
        "constituents_fetched": len(weights) if weights else 0,
        "industries_covered": len(industry_summary.get("industries", [])) if industry_summary else 0,
    }
    summary_path = out_dir / f"csi300_{mode}_summary_{date_str}.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] 摘要已保存: {summary_path}")

    return 0


# ──────────────────────────────────────────────
# CLI 入口
# ──────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="沪深300市场日报/周报生成器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument(
        "--date",
        default="",
        help="交易日，格式 YYYYMMDD（留空用最新交易日）",
    )
    ap.add_argument(
        "--mode",
        default="daily",
        choices=["daily", "weekly"],
        help="报告模式: daily（日报）/ weekly（周报）",
    )
    ap.add_argument(
        "--out-dir",
        default="",
        help="输出目录（默认 ./output）",
    )
    ap.add_argument(
        "--env-file",
        default="",
        help="PandaData .env 凭据文件路径（默认 ~/.pandadata/pandadata.env）",
    )
    ap.add_argument(
        "--focus",
        default="",
        help="重点关注板块或个股（例如: 银行、食品饮料）",
    )
    args = ap.parse_args()

    try:
        sys.exit(run(args))
    except Exception:
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()