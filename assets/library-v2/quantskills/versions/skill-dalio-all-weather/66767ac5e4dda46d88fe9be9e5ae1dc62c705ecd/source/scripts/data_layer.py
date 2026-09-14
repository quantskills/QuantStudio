"""Data access and validation for the All Weather research model.

Fund, index, and exchange-qualified futures fallbacks are combined by date.
Daily returns prefer ``log(close / pre_close)``; continuous close differences
are used only when ``pre_close`` is unavailable.  All five required asset
classes must exist and each must cover at least 80% of the union calendar.

CPI and GDP use explicit PI/NA symbols and become observable after separate
15-day and 30-day publication-lag approximations.  Historical vintages are not
available, so revised-value look-ahead cannot be eliminated.  Interest-rate
data is optional diagnostics only and always requires an explicit symbol.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import pandas as pd

logger = logging.getLogger("dalio.data")
logger.setLevel(logging.INFO)


# ============================================================
# 资产篮子定义
# ============================================================

@dataclass(frozen=True)
class AssetBasket:
    """一类资产的候选列表（ETF 优先 → 指数近似 → 期货主连兜底）。"""
    name: str
    etfs: tuple[str, ...] = ()            # get_fund_daily
    indexes: tuple[str, ...] = ()         # get_index_daily
    futures: tuple[str, ...] = ()         # get_future_daily 主连


# 五大类基准配置（象限权重在 portfolio.py 里定义）
BASKETS: dict[str, AssetBasket] = {
    "stock": AssetBasket(
        name="stock",
        etfs=("510300.SH", "510500.SH"),        # 沪深300 / 中证500 ETF
        indexes=("000300.SH", "000905.SH"),
    ),
    "bond_long": AssetBasket(                    # 长久期国债替代方案
        name="bond_long",
        etfs=("511260.SH",),                     # 10年国债 ETF
        indexes=("000012.SH",),                  # 上证国债指数（广义替代）
        futures=("T_DOMINANT.CFE",),             # 10 年期国债期货主连
    ),
    "bond_mid": AssetBasket(
        name="bond_mid",
        etfs=("511010.SH",),                     # 国债 ETF（5年附近）
        indexes=("000012.SH",),                  # 上证国债指数（广义替代）
        futures=("TF_DOMINANT.CFE",),            # 5 年期国债期货主连
    ),
    "gold": AssetBasket(
        name="gold",
        etfs=("518880.SH",),                     # 华安黄金 ETF
        futures=("AU_DOMINANT.SHF",),            # 黄金期货主连
    ),
    "commodity": AssetBasket(
        name="commodity",
        etfs=("501018.SH", "159985.SZ"),         # 南方原油 / 华夏饲料豆粕
        indexes=("000827.SH",),                  # 中证商品期货指数（如存在）
        futures=("CU_DOMINANT.SHF", "M_DOMINANT.DCE"),
    ),
}

# pandadata 明确指标代码，避免拉取整个宏观指标库后误选字段。
CPI_YOY_SYMBOL = "PI0000047"   # CPI: 当月同比
GDP_YOY_SYMBOL = "NA0000014"   # GDP: 不变价: 累计同比


# ============================================================
# 缓存
# ============================================================

REQUIRED_ASSETS = (
    "stock", "bond_long", "bond_mid", "gold", "commodity",
)
MIN_ASSET_COVERAGE = 0.80
PANDADATA_FETCH_ATTEMPTS = 3
PANDADATA_RETRY_BASE_DELAY_SECONDS = 0.25


class DataCoverageError(RuntimeError):
    """Raised when the five required research assets are not usable."""


def _cache_dir() -> Path:
    p = os.environ.get("ALLW_CACHE") or str(
        Path.home() / ".newmax" / "allw_cache"
    )
    d = Path(p)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_key(fn_name: str, **kwargs) -> Path:
    payload = json.dumps({"fn": fn_name, **kwargs}, sort_keys=True,
                          default=str)
    h = hashlib.sha1(
        payload.encode(),
        usedforsecurity=False,
    ).hexdigest()[:16]
    return _cache_dir() / f"{fn_name}_{h}.parquet"


def _cached(fn_name: str, loader, **kwargs) -> pd.DataFrame:
    path = _cache_key(fn_name, **kwargs)
    if path.exists():
        try:
            return pd.read_parquet(path)
        except Exception as e:
            logger.warning(
                "cache read failed %s (%s)", path.name, type(e).__name__
            )
    last_error: Exception | None = None
    for attempt in range(PANDADATA_FETCH_ATTEMPTS):
        try:
            df = loader()
            break
        except Exception as exc:
            last_error = exc
            if attempt >= PANDADATA_FETCH_ATTEMPTS - 1:
                raise
            logger.warning(
                "%s fetch failed; retrying (%d/%d, %s)",
                fn_name,
                attempt + 1,
                PANDADATA_FETCH_ATTEMPTS,
                type(exc).__name__,
            )
            time.sleep(
                PANDADATA_RETRY_BASE_DELAY_SECONDS * (2 ** attempt)
            )
    else:  # pragma: no cover - loop always returns or raises
        raise last_error or RuntimeError("pandadata fetch failed")
    if isinstance(df, pd.DataFrame) and not df.empty:
        try:
            df.to_parquet(path)
        except Exception as e:
            logger.warning(
                "cache write failed %s (%s)", path.name, type(e).__name__
            )
    return df


# ============================================================
# pandadata 封装
# ============================================================
# pandadata 服务端硬性时间上限（错误码 100008）：
#   - get_fund_daily / get_future_daily / get_stock_daily : 1 年
#   - get_index_daily                                     : 5 年
# 宏观类接口无此限制。
# 我们按接口硬上限分段循环拉取再拼接；缓存粒度到「每段」，可复用。

_INTERFACE_MAX_YEARS: dict[str, int] = {
    "fund_daily": 1,
    "future_daily": 1,
    "index_daily": 5,
    # 宏观接口服务端强制 ≤5 年（错误码：查询时间范围不能超过5年）
    "macro_pi": 5,
    "macro_ir": 5,
    "macro_na": 5,
}


def _pd_module():
    """惰性导入 panda_data，允许单元测试不安装 SDK 时也能 import 本模块。"""
    import panda_data as pd_
    return pd_


def _yyyymmdd(d: pd.Timestamp) -> str:
    return d.strftime("%Y%m%d")


def _split_range(start: str, end: str, max_years: int) -> list[tuple[str, str]]:
    """
    把 [start, end] 切成不超过 max_years 的子区间。
    pandadata 的判定是"end <= start + max_years"，为稳妥用 max_years*365-1 天。
    """
    s = pd.Timestamp(start)
    e = pd.Timestamp(end)
    if e <= s:
        return [(start, end)]
    step = pd.Timedelta(days=max_years * 365 - 1)
    out: list[tuple[str, str]] = []
    cur = s
    while cur <= e:
        nxt = min(cur + step, e)
        out.append((_yyyymmdd(cur), _yyyymmdd(nxt)))
        cur = nxt + pd.Timedelta(days=1)
    return out


def _chunked_fetch(interface: str, start: str, end: str,
                   single_call, **cache_kwargs) -> pd.DataFrame:
    """
    按接口硬上限自动切段的通用拉取器。
    - single_call(seg_start, seg_end) -> DataFrame，只拉一段。
    - 每段独立缓存，段拼接后再去重排序。
    """
    max_years = _INTERFACE_MAX_YEARS.get(interface)
    if max_years is None:
        # 宏观接口无上限，一次拉完
        def _once():
            return single_call(start, end)
        return _cached(interface, _once, s=start, e=end, **cache_kwargs)

    segments = _split_range(start, end, max_years)
    frames: list[pd.DataFrame] = []
    for seg_s, seg_e in segments:
        def _once(_s=seg_s, _e=seg_e):
            return single_call(_s, _e)
        df = _cached(interface, _once, s=seg_s, e=seg_e, **cache_kwargs)
        if isinstance(df, pd.DataFrame) and not df.empty:
            frames.append(df)
    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames, axis=0, ignore_index=True)
    # 按 trade_date（若存在）去重
    for c in ("trade_date", "date", "DATE"):
        if c in out.columns:
            out = out.drop_duplicates(subset=[c], keep="last").sort_values(c)
            break
    return out.reset_index(drop=True)


def fetch_index_daily(symbol: str, start: str, end: str) -> pd.DataFrame:
    def _one(s, e):
        return _pd_module().get_index_daily(symbol=symbol, start_date=s, end_date=e)
    return _chunked_fetch("index_daily", start, end, _one, symbol=symbol)


def fetch_fund_daily(symbol: str, start: str, end: str) -> pd.DataFrame:
    def _one(s, e):
        return _pd_module().get_fund_daily(start_date=s, end_date=e, symbol=symbol)
    return _chunked_fetch("fund_daily", start, end, _one, symbol=symbol)


def fetch_future_daily(symbol: str, start: str, end: str) -> pd.DataFrame:
    def _one(s, e):
        return _pd_module().get_future_daily(symbol=symbol, start_date=s, end_date=e)
    return _chunked_fetch("future_daily", start, end, _one, symbol=symbol)


def fetch_macro_pi(start: str, end: str,
                   symbol: str = CPI_YOY_SYMBOL) -> pd.DataFrame:
    """物价指数：CPI / PPI 等。列名依 SDK 而定，我们只关心 CPI YoY。"""
    def _one(s, e):
        return _pd_module().get_macro_pi(
            symbol=symbol, start_date=s, end_date=e
        )
    return _chunked_fetch("macro_pi", start, end, _one, symbol=symbol)


def fetch_macro_ir(start: str, end: str,
                   symbol: str | None = None) -> pd.DataFrame:
    """Fetch one explicitly selected interest-rate diagnostic series."""
    if not symbol or not symbol.strip():
        raise ValueError(
            "symbol is required for macro IR diagnostics; "
            "full-table queries are disabled"
        )
    def _one(s, e):
        return _pd_module().get_macro_ir(
            symbol=symbol, start_date=s, end_date=e
        )
    return _chunked_fetch(
        "macro_ir", start, end, _one, symbol=symbol
    )


def fetch_macro_na(start: str, end: str,
                   symbol: str = GDP_YOY_SYMBOL) -> pd.DataFrame:
    """国民经济核算：GDP 等。"""
    def _one(s, e):
        return _pd_module().get_macro_na(
            symbol=symbol, start_date=s, end_date=e
        )
    return _chunked_fetch("macro_na", start, end, _one, symbol=symbol)


def extract_macro_series(df: pd.DataFrame, symbol: str,
                         value_name: str) -> pd.DataFrame:
    """把 pandadata 的 symbol/period_date/data_value 归一为日期和值。"""
    if df.empty:
        return pd.DataFrame(columns=["date", value_name])
    required = {"period_date", "data_value"}
    if not required.issubset(df.columns):
        return pd.DataFrame(columns=["date", value_name])
    out = df.copy()
    if "symbol" in out.columns:
        out = out[out["symbol"].astype(str) == symbol]
    out = out[["period_date", "data_value"]].rename(
        columns={"period_date": "date", "data_value": value_name}
    )
    out["date"] = pd.to_datetime(out["date"].astype(str), errors="coerce")
    out[value_name] = pd.to_numeric(out[value_name], errors="coerce")
    return (out.dropna(subset=["date", value_name])
            .sort_values("date")
            .drop_duplicates("date", keep="last")
            .reset_index(drop=True))


# ============================================================
# 资产篮子 → 单一日度收益序列
# ============================================================

def _pick_close_column(df: pd.DataFrame) -> pd.Series:
    """从 pandadata 返回里挑收盘价列，允许字段名变动。"""
    if df.empty:
        return pd.Series(dtype=float)
    for col in ("close", "CLOSE", "settle", "SETTLE", "nav"):
        if col in df.columns:
            s = df[col]
            break
    else:
        # 兜底：数值列的最后一列
        num = df.select_dtypes(include=[np.number])
        if num.empty:
            return pd.Series(dtype=float)
        s = num.iloc[:, -1]
    # 索引统一到 DatetimeIndex
    for date_col in ("trade_date", "date", "DATE"):
        if date_col in df.columns:
            idx = pd.to_datetime(df[date_col])
            s = pd.Series(s.values, index=idx)
            break
    if not isinstance(s.index, pd.DatetimeIndex):
        s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _log_returns_from_frame(df: pd.DataFrame) -> tuple[pd.Series, str]:
    close = _pick_close_column(df)
    if close.empty:
        return pd.Series(dtype=float), "unavailable"

    pre_close_col = next(
        (name for name in ("pre_close", "PRE_CLOSE")
         if name in df.columns),
        None,
    )
    if pre_close_col is None:
        result = np.log(close).diff()
        return result.replace([np.inf, -np.inf], np.nan), "close_diff"

    pre_close = pd.to_numeric(df[pre_close_col], errors="coerce")
    for date_col in ("trade_date", "date", "DATE"):
        if date_col in df.columns:
            pre_close = pd.Series(
                pre_close.values,
                index=pd.to_datetime(df[date_col]),
            )
            break
    if not isinstance(pre_close.index, pd.DatetimeIndex):
        pre_close.index = pd.to_datetime(pre_close.index)
    ratio = close / pre_close.reindex(close.index)
    primary = np.log(ratio.where(ratio > 0))
    fallback = np.log(close).diff()
    result = primary.combine_first(fallback)
    return result.replace([np.inf, -np.inf], np.nan), "close/pre_close"


def load_basket_price(basket: AssetBasket, start: str, end: str
                      ) -> tuple[pd.Series, str]:
    """按 ETF → 指数 → 期货 的顺序尝试，返回 (价格序列, 实际使用的 symbol)。"""
    tries: list[tuple[str, callable]] = []
    for s in basket.etfs:
        tries.append((f"etf:{s}", lambda s=s: fetch_fund_daily(s, start, end)))
    for s in basket.indexes:
        tries.append((f"idx:{s}", lambda s=s: fetch_index_daily(s, start, end)))
    for s in basket.futures:
        tries.append((f"fut:{s}", lambda s=s: fetch_future_daily(s, start, end)))
    for label, loader in tries:
        try:
            df = loader()
        except Exception as e:
            logger.warning(
                "%s %s failed (%s)",
                basket.name, label, type(e).__name__,
            )
            continue
        s = _pick_close_column(df)
        if len(s.dropna()) > 60:
            return s, label
    logger.error("basket %s: 所有 symbol 均无数据", basket.name)
    return pd.Series(dtype=float), ""


def load_basket_returns(basket: AssetBasket, start: str, end: str
                        ) -> tuple[pd.Series, str]:
    """逐日按 ETF → 指数 → 期货回退，避免上市前收益被当成 0。"""
    tries: list[tuple[str, callable]] = []
    for symbol in basket.etfs:
        tries.append((f"etf:{symbol}",
                      lambda symbol=symbol: fetch_fund_daily(symbol, start, end)))
    for symbol in basket.indexes:
        tries.append((f"idx:{symbol}",
                      lambda symbol=symbol: fetch_index_daily(symbol, start, end)))
    for symbol in basket.futures:
        tries.append((f"fut:{symbol}",
                      lambda symbol=symbol: fetch_future_daily(symbol, start, end)))

    combined = pd.Series(dtype=float)
    used: list[str] = []
    for label, loader in tries:
        try:
            candidate, return_method = _log_returns_from_frame(loader())
        except Exception as e:
            logger.warning(
                "%s %s failed (%s)",
                basket.name, label, type(e).__name__,
            )
            continue
        if candidate.notna().sum() < 20:
            continue
        before = combined.notna().sum()
        combined = candidate if combined.empty else combined.combine_first(candidate)
        if combined.notna().sum() > before:
            used.append(f"{label} [{return_method}]")

    if combined.empty:
        logger.error("basket %s: 所有 symbol 均无可用收益", basket.name)
        return combined, ""
    return combined.sort_index(), " -> ".join(used)


def validate_asset_coverage(
        returns: pd.DataFrame,
        min_coverage: float = MIN_ASSET_COVERAGE) -> pd.Series:
    missing = [
        name for name in REQUIRED_ASSETS
        if name not in returns.columns or returns[name].notna().sum() == 0
    ]
    if missing:
        raise DataCoverageError(
            "missing required assets: " + ", ".join(missing)
        )

    coverage = returns.loc[:, list(REQUIRED_ASSETS)].notna().mean()
    inadequate = coverage[coverage < min_coverage]
    if not inadequate.empty:
        details = ", ".join(
            f"{name}={value:.1%}" for name, value in inadequate.items()
        )
        raise DataCoverageError(
            f"asset coverage below {min_coverage:.0%}: {details}"
        )
    return coverage


def build_asset_returns(start: str, end: str
                        ) -> tuple[pd.DataFrame, dict[str, str]]:
    """
    构建 5 大类资产的日度收益 DataFrame。
    返回:
      returns: index=交易日, columns=['stock','bond_long','bond_mid','gold','commodity']
      used:    {'stock': 'etf:510300.SH', ...} 实际使用的 symbol
    """
    series: dict[str, pd.Series] = {}
    used: dict[str, str] = {}
    for name, basket in BASKETS.items():
        ret, tag = load_basket_returns(basket, start, end)
        used[name] = tag
        if not ret.empty:
            series[name] = ret
    df = pd.concat(series, axis=1).sort_index() if series else pd.DataFrame()
    df = df.loc[start:end]
    coverage = validate_asset_coverage(df)
    complete = df.loc[:, list(REQUIRED_ASSETS)].dropna(how="any")
    if complete.empty:
        raise DataCoverageError(
            "no dates have complete coverage for all required assets"
        )
    complete.attrs["asset_coverage"] = {
        name: float(value) for name, value in coverage.items()
    }
    complete.attrs["minimum_asset_coverage"] = MIN_ASSET_COVERAGE
    return complete, used


# ============================================================
# 宏观 → 交易日频率
# ============================================================

# 在只有 period_date、没有真实 release_date 时使用分项发布时间近似。
CPI_PUB_LAG_DAYS = 15
GDP_PUB_LAG_DAYS = 30


def _to_daily_ffill(macro_df: pd.DataFrame, value_col: str,
                    trading_days: pd.DatetimeIndex,
                    publication_lag_days: int,
                    ) -> pd.Series:
    """
    将月/季频宏观数据按指定公布滞后前向填充到交易日频率。
    macro_df 需要含日期列(或索引)与 value_col。
    """
    if macro_df.empty or value_col not in macro_df.columns:
        return pd.Series(index=trading_days, dtype=float)
    df = macro_df.copy()
    # 找日期列
    date_col = None
    for c in ("date", "trade_date", "report_date", "period_date",
              "period", "stat_date"):
        if c in df.columns:
            date_col = c
            break
    if date_col is None:
        # 假设索引就是日期
        df["_d"] = pd.to_datetime(df.index)
        date_col = "_d"
    df[date_col] = (
        pd.to_datetime(df[date_col])
        + pd.Timedelta(days=publication_lag_days)
    )
    df = df.sort_values(date_col).drop_duplicates(date_col, keep="last")
    s = pd.Series(df[value_col].values, index=df[date_col])
    return s.reindex(trading_days.union(s.index)).ffill().reindex(trading_days)


def align_macro_to_daily(cpi_yoy: pd.DataFrame, gdp_yoy: pd.DataFrame,
                          trading_days: pd.DatetimeIndex,
                          cpi_col: str = "cpi_yoy",
                          gdp_col: str = "gdp_yoy") -> pd.DataFrame:
    """把 CPI YoY 与 GDP YoY 对齐到交易日。"""
    out = pd.DataFrame(index=trading_days)
    out["cpi_yoy"] = _to_daily_ffill(
        cpi_yoy, cpi_col, trading_days, CPI_PUB_LAG_DAYS
    )
    out["gdp_yoy"] = _to_daily_ffill(
        gdp_yoy, gdp_col, trading_days, GDP_PUB_LAG_DAYS
    )
    return out


# ============================================================
# 便利入口
# ============================================================

def load_all(start: str, end: str
             ) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, str]]:
    """
    返回:
      returns:  5 大类资产日度对数收益
      macro:    对齐到交易日的 cpi_yoy / gdp_yoy
      used:     实际使用的 symbol 映射（便于报告）
    """
    returns, used = build_asset_returns(start, end)
    cpi = extract_macro_series(
        fetch_macro_pi(start, end), CPI_YOY_SYMBOL, "cpi_yoy"
    )
    gdp = extract_macro_series(
        fetch_macro_na(start, end), GDP_YOY_SYMBOL, "gdp_yoy"
    )
    macro = align_macro_to_daily(
        cpi,
        gdp,
        returns.index if not returns.empty else pd.DatetimeIndex([]),
    )
    return returns, macro, used
