# -*- coding: utf-8 -*-
"""as_of 交易日历门禁：live 经 Pandadata get_trade_cal 校验。

配置：
  as_of_calendar:
    mode: soft          # off | soft | hard
    exchange: SH
    snap_to_prev: true
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

CAL_MODES = ("off", "soft", "hard")


def _ymd_compact(as_of: str) -> str:
    s = str(as_of).strip().replace("-", "")
    if len(s) != 8 or not s.isdigit():
        raise ValueError(f"as_of must be YYYY-MM-DD or YYYYMMDD, got={as_of!r}")
    return s


def _ymd_dash(compact: str) -> str:
    return f"{compact[:4]}-{compact[4:6]}-{compact[6:8]}"


def resolve_calendar_mode(cal_cfg: Dict[str, Any]) -> str:
    """解析 mode；兼容旧键 require=true/false → hard/soft。"""
    raw = cal_cfg.get("mode")
    if raw is not None:
        mode = str(raw).strip().lower()
        if mode not in CAL_MODES:
            raise ValueError(f"as_of_calendar.mode must be one of {CAL_MODES}, got={raw!r}")
        return mode
    if "require" in cal_cfg:
        return "hard" if bool(cal_cfg.get("require")) else "soft"
    return "soft"


def parse_is_trade(row: Any) -> Optional[int]:
    """从 get_trade_cal 行解析 is_trade；无法解析返回 None。"""
    if row is None:
        return None
    if isinstance(row, dict):
        val = row.get("is_trade", row.get("is_trading_day"))
    else:
        try:
            val = row["is_trade"] if "is_trade" in getattr(row, "index", []) else row.get("is_trade")
        except Exception:
            try:
                val = getattr(row, "is_trade", None)
            except Exception:
                val = None
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def evaluate_calendar_row(as_of: str, row: Any) -> Dict[str, Any]:
    """纯函数：根据单日日历行判定 as_of 是否交易日。"""
    compact = _ymd_compact(as_of)
    is_trade = parse_is_trade(row)
    if is_trade is None:
        return {
            "ok": False,
            "as_of": _ymd_dash(compact),
            "is_trade": None,
            "error": "calendar row missing is_trade",
            "suggested_as_of": None,
        }
    if is_trade == 1:
        return {
            "ok": True,
            "as_of": _ymd_dash(compact),
            "is_trade": 1,
            "error": None,
            "suggested_as_of": None,
        }
    suggested = None
    if isinstance(row, dict):
        suggested = row.get("pretrade_date")
    else:
        suggested = getattr(row, "pretrade_date", None) if hasattr(row, "pretrade_date") else None
        if suggested is None and hasattr(row, "get"):
            suggested = row.get("pretrade_date")
    if suggested is not None:
        suggested = str(suggested).replace("-", "")
        if len(suggested) == 8 and suggested.isdigit():
            suggested = _ymd_dash(suggested)
        else:
            suggested = None
    return {
        "ok": False,
        "as_of": _ymd_dash(compact),
        "is_trade": 0,
        "error": f"as_of={_ymd_dash(compact)} is not a trading day",
        "suggested_as_of": suggested,
    }


def _fetch_trade_cal_row(as_of: str, exchange: str = "SH") -> Tuple[Optional[Any], Optional[str]]:
    """调用 Pandadata get_trade_cal；返回 (row, error)。"""
    compact = _ymd_compact(as_of)
    try:
        import panda_data  # type: ignore
    except Exception as exc:  # noqa: BLE001
        return None, f"panda_data import failed: {exc}"

    try:
        start = (datetime.strptime(compact, "%Y%m%d") - timedelta(days=7)).strftime("%Y%m%d")
        end = (datetime.strptime(compact, "%Y%m%d") + timedelta(days=7)).strftime("%Y%m%d")
        result = panda_data.get_trade_cal(
            start_date=start,
            end_date=end,
            exchange=exchange,
            is_trading_day=None,
            fields=[],
        )
    except Exception as exc:  # noqa: BLE001
        return None, f"get_trade_cal failed: {exc}"

    if result is None:
        return None, "get_trade_cal returned None"

    try:
        if hasattr(result, "empty"):
            if result.empty:
                return None, "get_trade_cal empty"
            col = "nature_date" if "nature_date" in result.columns else None
            if not col:
                return None, "get_trade_cal missing nature_date"
            matched = result[result[col].astype(str).str.replace("-", "", regex=False) == compact]
            if matched.empty:
                return None, f"no calendar row for {compact}"
            return matched.iloc[0], None
        if isinstance(result, list):
            for row in result:
                nd = str(row.get("nature_date", "")).replace("-", "")
                if nd == compact:
                    return row, None
            return None, f"no calendar row for {compact}"
    except Exception as exc:  # noqa: BLE001
        return None, f"parse get_trade_cal failed: {exc}"
    return None, "unsupported get_trade_cal payload"


def _fail_or_warn(base: Dict[str, Any], cal_mode: str, msg: str) -> Dict[str, Any]:
    if cal_mode == "hard":
        base["ok"] = False
        base["errors"].append(msg)
    else:
        base["warnings"].append(msg)
    return base


def enforce_as_of_calendar(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """执行 as_of 交易日历门禁。

    - source_mode=mock → 跳过
    - as_of_calendar.mode=off → 跳过
    - soft：缺凭证 / API 失败 / 非交易日（未 snap）→ warning，不阻断
    - hard：上述问题硬失败；非交易日可 snap_to_prev
    """
    source_mode = str(cfg.get("source_mode") or "").lower()
    as_of = str(cfg.get("as_of") or "")
    cal_cfg = dict(cfg.get("as_of_calendar") or {})
    exchange = str(cal_cfg.get("exchange") or "SH")
    snap = bool(cal_cfg.get("snap_to_prev", True))
    cal_mode = resolve_calendar_mode(cal_cfg)

    base: Dict[str, Any] = {
        "ok": True,
        "skipped": False,
        "mode": cal_mode,
        "source_mode": source_mode,
        "as_of": as_of,
        "exchange": exchange,
        "checked": False,
        "is_trade": None,
        "errors": [],
        "warnings": [],
        "suggested_as_of": None,
        "snapped": False,
    }

    if source_mode == "mock" or cal_mode == "off":
        base["skipped"] = True
        base["warnings"].append(
            "mock: trade calendar check skipped"
            if source_mode == "mock"
            else "as_of_calendar.mode=off"
        )
        return base

    if source_mode not in {"live", "degraded"}:
        base["ok"] = False
        base["errors"].append(f"unknown source_mode={source_mode}")
        return base

    from runtime.pandadata_gate import has_pandadata_credentials

    if not has_pandadata_credentials():
        return _fail_or_warn(
            base, cal_mode, "trade calendar skipped: PANDA_DATA credentials missing"
        )

    row, err = _fetch_trade_cal_row(as_of, exchange=exchange)
    if err:
        return _fail_or_warn(base, cal_mode, err)

    verdict = evaluate_calendar_row(as_of, row)
    base["checked"] = True
    base["is_trade"] = verdict.get("is_trade")
    base["suggested_as_of"] = verdict.get("suggested_as_of")

    if verdict["ok"]:
        return base

    if snap and verdict.get("suggested_as_of"):
        cfg["as_of"] = verdict["suggested_as_of"]
        base["as_of"] = cfg["as_of"]
        base["snapped"] = True
        base["warnings"].append(
            f"{verdict['error']}; snapped to prev trade day {cfg['as_of']}"
        )
        return base

    msg = verdict["error"] + (
        f"; suggested_as_of={verdict['suggested_as_of']}"
        if verdict.get("suggested_as_of")
        else ""
    )
    return _fail_or_warn(base, cal_mode, msg)
