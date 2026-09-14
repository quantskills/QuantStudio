"""RESEARCH_ONLY CLI for the A-share All Weather model.

子命令：
  health-check        检查 Python、SDK、服务方 HTTPS 与凭证配置
  check-login          验证 pandadata 凭证
  current-allocation   输出反波动率目标与实际风险贡献诊断
  backtest             运行带预热、持仓漂移和真实换手成本的回测
  diagnose-regime      输出 CPI/GDP 象限诊断；IR 仅限显式 symbol
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# 允许在 skill 根目录 & scripts 目录两种方式启动
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from data_layer import (  # noqa: E402
                        load_all, fetch_macro_ir, BASKETS,
                        CPI_YOY_SYMBOL, GDP_YOY_SYMBOL,
                        CPI_PUB_LAG_DAYS, GDP_PUB_LAG_DAYS,
                        REQUIRED_ASSETS, MIN_ASSET_COVERAGE)
from regime import (  # noqa: E402
                    classify, current_quadrant,
                    DEFAULT_LONG_CHANGE_DAYS, DEFAULT_SMOOTH_WINDOW,
                    DEFAULT_MIN_HOLD_DAYS)
from portfolio import (  # noqa: E402
                       build_weights, DEFAULT_BASE_ALLOCATION,
                       DEFAULT_QUADRANT_TILT, DEFAULT_VOL_MIN_PERIODS,
                       DEFAULT_VOL_FLOOR, DEFAULT_TURNOVER_THRESHOLD,
                       ALLOCATION_METHOD,
                       risk_contribution_diagnostic)
from backtest import run as run_backtest      # noqa: E402
from pandadata_security import (              # noqa: E402
    PandaDataSecurityError,
    establish_session,
    startup_health_check,
)


logging.basicConfig(
    level=os.environ.get("ALLW_LOG", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("dalio.cli")
SKILL_VERSION = "0.5.0"
WARMUP_CALENDAR_DAYS = 400


def _env_candidates() -> list[Path]:
    """按优先级返回本地凭证文件；环境变量始终拥有最高优先级。"""
    return [Path.home() / ".pandadata.env"]


_CREDENTIAL_KEYS = {
    "PANDADATA_USER", "PANDADATA_PASSWORD", "PANDA_USERNAME",
    "PANDA_PASSWORD", "PANDADATA_TOKEN", "PANDADATA_BASE_URL",
}


def _load_dotenv(candidates: Optional[list[Path]] = None) -> Optional[Path]:
    """读取第一个存在的 .env，且不覆盖进程中已经设置的环境变量。"""
    for candidate in candidates or _env_candidates():
        if not candidate.exists():
            continue
        for raw in candidate.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key in _CREDENTIAL_KEYS:
                os.environ.setdefault(
                    key, value.strip().strip('"').strip("'")
                )
        return candidate
    return None


def _credentials() -> tuple[str, str]:
    user = (os.environ.get("PANDADATA_USER")
            or os.environ.get("PANDA_USERNAME") or "").strip()
    pwd = (os.environ.get("PANDADATA_PASSWORD")
           or os.environ.get("PANDA_PASSWORD") or "").strip()
    return user, pwd


def _login() -> str:
    user, pwd = _credentials()
    supplied_token = os.environ.get("PANDADATA_TOKEN", "").strip()
    if not supplied_token and (not user or not pwd):
        raise RuntimeError("缺少 pandadata 凭证")
    import panda_data as pd_
    last_error = None
    for attempt in range(3):
        try:
            return establish_session(
                pd_,
                username=user,
                password=pwd,
                token=supplied_token,
            )
        except PandaDataSecurityError:
            raise
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.5 * (2 ** attempt))
    raise RuntimeError(
        f"pandadata 登录失败（{type(last_error).__name__}）"
    ) from None


def _out_dir() -> Path:
    p = Path(os.environ.get("ALLW_OUT",
                             Path.cwd() / "outputs" / "dalio_all_weather"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def _today_str() -> str:
    t = os.environ.get("ALLW_TODAY")
    if t:
        return t
    return pd.Timestamp.today().strftime("%Y%m%d")


def _date_tag(value: str) -> str:
    return pd.to_datetime(value).strftime("%Y%m%d")


def _warmup_start(requested_start: str) -> str:
    start = pd.to_datetime(requested_start)
    return (start - pd.Timedelta(days=WARMUP_CALENDAR_DAYS)).strftime(
        "%Y%m%d"
    )


def _source_fingerprint() -> str:
    digest = hashlib.sha256()
    for path in sorted(_HERE.glob("*.py"), key=lambda item: item.name):
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _compact_number(value: float) -> str:
    return f"{float(value):g}".replace("-", "m").replace(".", "p")


def _build_run_id(args, end: str) -> str:
    payload = {
        "requested_start": _date_tag(args.start),
        "requested_end": _date_tag(end),
        "rebalance": args.rebalance,
        "vol_window": int(args.vol_window),
        "cost_bps": float(args.cost_bps),
        "turnover_threshold": float(getattr(
            args, "turnover_threshold", DEFAULT_TURNOVER_THRESHOLD
        )),
        "rebalance_on_regime_change": bool(getattr(
            args, "rebalance_on_regime_change", False
        )),
    }
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()[:10]
    return (
        f"{args.rebalance}-v{int(args.vol_window)}"
        f"-c{_compact_number(args.cost_bps)}"
        f"-t{_compact_number(payload['turnover_threshold'])}"
        f"-r{int(payload['rebalance_on_regime_change'])}-{digest}"
    )


def _frame_fingerprint(frame: pd.DataFrame) -> str:
    """Stable content fingerprint for reproducibility checks; contains no secrets."""
    ordered = frame.sort_index().sort_index(axis=1)
    hashed = pd.util.hash_pandas_object(ordered, index=True).values.tobytes()
    return hashlib.sha256(hashed).hexdigest()


def _prepare_run_output_dir(out: Path, run_meta: dict) -> None:
    """Create a run directory or reject a conflicting prior run."""
    try:
        out.mkdir(parents=True, exist_ok=False)
        return
    except FileExistsError:
        pass

    metrics_path = out / "metrics.json"
    if not metrics_path.is_file():
        if any(out.iterdir()):
            raise RuntimeError(
                "output fingerprint cannot be verified for an existing directory"
            )
        return

    try:
        prior = json.loads(metrics_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RuntimeError(
            "output fingerprint cannot be verified for an existing directory"
        ) from exc

    prior_identity = {
        "run_id": prior.get("run_id"),
        "data_fingerprint": prior.get("data_fingerprint"),
        "source_sha256": prior.get("software", {}).get("source_sha256"),
    }
    incoming_identity = {
        "run_id": run_meta.get("run_id"),
        "data_fingerprint": run_meta.get("data_fingerprint"),
        "source_sha256": run_meta.get("software", {}).get("source_sha256"),
    }
    if prior_identity != incoming_identity:
        raise RuntimeError(
            "output fingerprint differs from the existing run"
        )


def _package_version(name: str) -> str:
    try:
        return version(name)
    except PackageNotFoundError:
        return "unknown"


def _build_run_metadata(
        args,
        end: str,
        returns: pd.DataFrame,
        macro: pd.DataFrame,
        used: dict,
        *,
        data_start: str | None = None,
        actual_eval_start: str | None = None,
        risk_diagnostic: Optional[dict] = None) -> dict:
    baskets = {
        name: {
            "etfs": list(basket.etfs), "indexes": list(basket.indexes),
            "futures": list(basket.futures),
        }
        for name, basket in BASKETS.items()
    }
    requested_start = _date_tag(args.start)
    requested_end = _date_tag(end)
    actual_end = (
        returns.index.max().strftime("%Y%m%d")
        if not returns.empty else ""
    )
    run_id = _build_run_id(args, end)
    turnover_threshold = float(getattr(
        args, "turnover_threshold", DEFAULT_TURNOVER_THRESHOLD
    ))
    rebalance_on_regime_change = bool(getattr(
        args, "rebalance_on_regime_change", False
    ))
    asset_coverage = returns.attrs.get("asset_coverage")
    if asset_coverage is None:
        available = [
            name for name in REQUIRED_ASSETS if name in returns.columns
        ]
        asset_coverage = {
            name: float(returns[name].notna().mean())
            for name in available
        }
    return {
        "run_id": run_id,
        "run_config": {
            "requested_start": requested_start,
            "requested_end": requested_end,
            "data_start": _date_tag(data_start or requested_start),
            "actual_eval_start": _date_tag(
                actual_eval_start or requested_start
            ),
            "actual_eval_end": actual_end,
            "rebalance": args.rebalance, "vol_window": args.vol_window,
            "cost_bps": args.cost_bps,
            "cost_convention": (
                "execution-day L1 turnover multiplied by cost_bps once"
            ),
            "turnover_threshold": turnover_threshold,
            "rebalance_on_regime_change": rebalance_on_regime_change,
            "allocation_method": ALLOCATION_METHOD,
            "return_method": (
                "log(close/pre_close) when available; "
                "otherwise log(close).diff()"
            ),
            "vol_min_periods": DEFAULT_VOL_MIN_PERIODS,
            "vol_floor": DEFAULT_VOL_FLOOR,
            "regime_long_change_days": DEFAULT_LONG_CHANGE_DAYS,
            "regime_smooth_window": DEFAULT_SMOOTH_WINDOW,
            "regime_hysteresis_days": DEFAULT_MIN_HOLD_DAYS,
            "cpi_publication_lag_days": CPI_PUB_LAG_DAYS,
            "gdp_publication_lag_days": GDP_PUB_LAG_DAYS,
            "cpi_symbol": CPI_YOY_SYMBOL, "gdp_symbol": GDP_YOY_SYMBOL,
            "base_allocation": DEFAULT_BASE_ALLOCATION.to_dict(),
            "quadrant_tilt": {
                key: weights.to_dict()
                for key, weights in DEFAULT_QUADRANT_TILT.items()
            },
            "asset_baskets": baskets,
        },
        "data_fingerprint": {
            "returns_sha256": _frame_fingerprint(returns),
            "macro_sha256": _frame_fingerprint(macro),
        },
        "data_quality": {
            "required_assets": list(REQUIRED_ASSETS),
            "minimum_asset_coverage": MIN_ASSET_COVERAGE,
            "asset_coverage": asset_coverage,
        },
        "used_symbols": used,
        "risk_contribution": risk_diagnostic or {},
        "software": {
            "python": sys.version.split()[0],
            "pandas": pd.__version__, "numpy": np.__version__,
            "panda_data": _package_version("panda_data"),
            "skill_version": SKILL_VERSION,
            "source_sha256": _source_fingerprint(),
        },
        "limitations": [
            "宏观接口无历史发布版本；CPI 15 日、GDP 30 日延迟后仍可能使用修订值。",
            "长债久期和商品覆盖弱于经典全天候。",
            "000012.SH 是广义国债指数替代，不代表精确的 10 年或 5 年久期。",
            "默认方法是带象限基准的反波动率风险预算，不是严格 ERC。",
            "期货展期、税费、滑点和可成交性未完整模拟。",
            "历史正收益不保证未来表现。",
            "本结果仅供研究，不构成实盘许可或投资建议，不可直接用于实盘。",
        ],
    }


# -------- 子命令 --------------------------------------------------------

def cmd_health_check(args) -> int:
    """Check runtime, SDK, provider HTTPS, and credential readiness."""
    _load_dotenv()
    try:
        report = startup_health_check(
            timeout=args.timeout,
            require_credentials=not args.transport_only,
        )
    except PandaDataSecurityError as exc:
        print(f"[FAIL] 启动健康检查未通过：{exc}")
        return 1
    except Exception as exc:
        print(f"[FAIL] 启动健康检查失败（{type(exc).__name__}）")
        return 1

    print("OK  启动健康检查通过")
    print(f"Python：{report['python']}")
    print(f"HTTPS 端点：{report['endpoint']}")
    print(f"TLS：{report['tls_version']}")
    print(f"SDK：{report['sdk']}")
    print(f"凭证方式：{report['auth_mode']}")
    return 0


def cmd_check_login(args) -> int:
    try:
        _load_dotenv()
        _login()
    except Exception as e:
        message = "缺少 pandadata 凭证" if "缺少 pandadata 凭证" in str(e) \
            else f"pandadata 登录失败（{type(e).__name__}）"
        print(f"[FAIL] {message}")
        return 1
    user, _ = _credentials()
    print("OK  pandadata 登录成功")
    print(f"资产篮子候选: {[b for b in BASKETS.keys()]}")
    return 0


def cmd_current_allocation(args) -> int:
    end = args.end or _today_str()
    end_ts = pd.to_datetime(end)
    start = args.start or (end_ts - pd.DateOffset(years=3)).strftime("%Y%m%d")
    log.info("拉取数据 %s → %s", start, end)
    try:
        returns, macro, used = load_all(start, end)
    except Exception as exc:
        print(f"[ERROR] 数据加载失败（{type(exc).__name__}）")
        return 2
    if returns.empty:
        print("[ERROR] 无法构建资产收益序列，请检查凭证与网络")
        return 2

    regime = classify(macro)
    weights = build_weights(
        returns,
        regime.quadrant,
        rebalance="Q",
        vol_window=60,
        observation_start=start,
        observation_end=end,
    )

    q_key, q_label = current_quadrant(regime)
    last_w = weights.daily_weights.iloc[-1]
    vol_last = returns.rolling(60, min_periods=20).std().iloc[-1] * np.sqrt(252)
    risk_diagnostic = risk_contribution_diagnostic(
        last_w,
        returns.tail(60).cov(),
    )
    risk_contribution = pd.Series(
        risk_diagnostic["by_asset"],
        dtype=float,
    ).reindex(last_w.index)

    out = _out_dir() / f"allocation_{_date_tag(end)}.csv"
    df = pd.DataFrame({
        "target_weight": last_w,
        "ann_vol_60d": vol_last,
        "risk_contribution_60d": risk_contribution,
        "risk_concentration_max": risk_diagnostic["max_contribution"],
        "actual_symbol": pd.Series(used),
        "quadrant_key": q_key,
        "quadrant_label": q_label,
        "research_status": "RESEARCH_ONLY",
    })
    df.to_csv(out, encoding="utf-8-sig")
    allocation_metadata = {
        "config": {
            "requested_start": _date_tag(start),
            "requested_end": _date_tag(end),
            "actual_data_start": returns.index.min().strftime("%Y%m%d"),
            "actual_data_end": returns.index.max().strftime("%Y%m%d"),
            "vol_window": 60,
            "allocation_method": ALLOCATION_METHOD,
            "long_change_days": DEFAULT_LONG_CHANGE_DAYS,
            "smooth_window": DEFAULT_SMOOTH_WINDOW,
            "hysteresis_days": DEFAULT_MIN_HOLD_DAYS,
            "cpi_publication_lag_days": CPI_PUB_LAG_DAYS,
            "gdp_publication_lag_days": GDP_PUB_LAG_DAYS,
        },
        "data_fingerprint": {
            "returns_sha256": _frame_fingerprint(returns),
            "macro_sha256": _frame_fingerprint(macro),
        },
        "data_quality": {
            "required_assets": list(REQUIRED_ASSETS),
            "minimum_asset_coverage": MIN_ASSET_COVERAGE,
            "asset_coverage": returns.attrs.get(
                "asset_coverage",
                {
                    name: float(returns[name].notna().mean())
                    for name in REQUIRED_ASSETS
                    if name in returns.columns
                },
            ),
        },
        "used_symbols": used,
        "risk_contribution": {
            **risk_diagnostic,
            "window": 60,
            "observations": int(len(returns.tail(60))),
            "weights_basis": "latest_target",
            "as_of": returns.index.max().strftime("%Y%m%d"),
        },
        "software": {
            "skill_version": SKILL_VERSION,
            "source_sha256": _source_fingerprint(),
            "python": sys.version.split()[0],
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "panda_data": _package_version("panda_data"),
        },
        "limitations": [
            "RESEARCH_ONLY：仅供研究，不可直接用于实盘。",
            "默认反波动率风险预算不是严格 ERC。",
            "宏观历史修订版本不可得。",
        ],
    }
    metadata_out = out.parent / (
        f"allocation_{_date_tag(end)}_metadata.json"
    )
    with open(metadata_out, "w", encoding="utf-8") as handle:
        json.dump(
            allocation_metadata,
            handle,
            ensure_ascii=False,
            indent=2,
        )

    print("=" * 60)
    print(f"当前宏观象限: {q_key}  ({q_label})")
    print(f"最新数据日期: {last_w.name.date()}")
    print("-" * 60)
    print(df.to_string(float_format=lambda x: f"{x:.4f}"))
    if (
        risk_diagnostic["max_contribution"] is not None
        and risk_diagnostic["max_contribution"] > 0.50
    ):
        print("[WARN] 60 日协方差风险贡献较集中；这不是等风险组合。")
    print("-" * 60)
    print(f"CSV 已保存: {out}")
    return 0


def cmd_backtest(args) -> int:
    requested_start = args.start
    end = args.end or _today_str()
    data_start = _warmup_start(requested_start)
    log.info(
        "回测 %s → %s（预热数据从 %s 开始）",
        requested_start, end, data_start,
    )
    try:
        returns, macro, used = load_all(data_start, end)
    except Exception as exc:
        print(f"[ERROR] 数据加载失败（{type(exc).__name__}）")
        return 2
    if returns.empty:
        print("[ERROR] 数据不足，无法回测")
        return 2
    evaluation_dates = returns.index[
        returns.index >= pd.Timestamp(requested_start)
    ]
    if evaluation_dates.empty:
        print("[ERROR] 请求起点之后没有共同交易日")
        return 2
    actual_eval_start = evaluation_dates[0]

    regime = classify(macro)
    weights = build_weights(
        returns,
        regime.quadrant,
        rebalance=args.rebalance,
        vol_window=args.vol_window,
        rebalance_on_regime_change=args.rebalance_on_regime_change,
        observation_start=data_start,
        observation_end=end,
    )
    result = run_backtest(
        returns,
        weights.daily_weights,
        regime.quadrant,
        cost_bps=args.cost_bps,
        decision_dates=weights.decision_dates,
        turnover_threshold=args.turnover_threshold,
        evaluation_start=actual_eval_start,
    )

    covariance_window = returns.tail(args.vol_window)
    risk_diagnostic = risk_contribution_diagnostic(
        weights.daily_weights.iloc[-1],
        covariance_window.cov(),
    )
    risk_diagnostic["window"] = int(args.vol_window)
    risk_diagnostic["observations"] = int(len(covariance_window))
    risk_diagnostic["weights_basis"] = "latest_target"
    risk_diagnostic["as_of"] = returns.index.max().strftime("%Y%m%d")

    run_meta = _build_run_metadata(
        args,
        end,
        returns,
        macro,
        used,
        data_start=data_start,
        actual_eval_start=actual_eval_start.strftime("%Y%m%d"),
        risk_diagnostic=risk_diagnostic,
    )
    run_id = run_meta["run_id"]
    out = _out_dir() / f"backtest_{_date_tag(end)}_{run_id}"
    try:
        _prepare_run_output_dir(out, run_meta)
    except RuntimeError as exc:
        print(f"[ERROR] {exc}")
        return 2
    result.equity.to_csv(out / "equity.csv", encoding="utf-8-sig",
                          header=["equity"])
    result.daily_return.to_csv(out / "daily_return.csv",
                                encoding="utf-8-sig",
                                header=["net_ret"])
    result.weights_used.to_csv(out / "weights_used.csv",
                                encoding="utf-8-sig")
    result.turnover.to_csv(
        out / "turnover.csv",
        encoding="utf-8-sig",
        header=["l1_turnover"],
    )
    pd.Series(
        result.executed_rebalance_dates,
        name="execution_date",
    ).to_csv(
        out / "executed_rebalances.csv",
        index=False,
        encoding="utf-8-sig",
    )
    decision_rows = []
    for decision_date in weights.decision_dates:
        position = returns.index.get_indexer([decision_date])[0]
        next_date = (
            returns.index[position + 1]
            if position >= 0 and position + 1 < len(returns.index)
            else pd.NaT
        )
        decision_rows.append({
            "decision_date": decision_date,
            "next_common_trading_date": next_date,
        })
    decision_audit = pd.DataFrame(
        decision_rows,
        columns=["decision_date", "next_common_trading_date"],
    )
    decision_audit.to_csv(
        out / "decision_dates.csv",
        index=False,
        encoding="utf-8-sig",
        date_format="%Y-%m-%d",
    )
    target_audit = decision_audit.copy()
    if len(target_audit):
        decision_targets = weights.daily_weights.loc[
            weights.decision_dates
        ].reset_index(drop=True)
        target_audit = pd.concat(
            [target_audit.reset_index(drop=True), decision_targets],
            axis=1,
        )
    else:
        for asset in returns.columns:
            target_audit[asset] = pd.Series(dtype=float)
    target_audit.to_csv(
        out / "target_weights.csv",
        index=False,
        encoding="utf-8-sig",
        date_format="%Y-%m-%d",
    )
    result.by_quadrant.to_csv(out / "by_quadrant.csv",
                               encoding="utf-8-sig")
    with open(out / "metrics.json", "w", encoding="utf-8") as f:
        json.dump({**result.metrics, **run_meta}, f, ensure_ascii=False, indent=2)
    with open(out / "used_symbols.json", "w", encoding="utf-8") as f:
        json.dump(used, f, ensure_ascii=False, indent=2)

    _plot_backtest(result, out)
    _write_report(result, weights, used, out, run_meta)

    print("回测完成:")
    for k, v in result.metrics.items():
        print(f"  {k:<22}: {v}")
    print(f"结果目录: {out}")
    return 0


def cmd_diagnose_regime(args) -> int:
    end = args.end or _today_str()
    end_ts = pd.to_datetime(end)
    start = args.start or (end_ts - pd.DateOffset(years=10)).strftime("%Y%m%d")
    try:
        returns, macro, _ = load_all(start, end)
    except Exception as exc:
        print(f"[ERROR] 数据加载失败（{type(exc).__name__}）")
        return 2
    if macro.empty:
        print("[ERROR] 无宏观数据")
        return 2
    regime = classify(macro)
    out = _out_dir() / f"diagnose_{_date_tag(end)}"
    out.mkdir(exist_ok=True)
    diagnostics = regime.diagnostics.copy()
    diagnostics["research_status"] = "RESEARCH_ONLY"
    diagnostics.to_csv(
        out / "diagnostics.csv", encoding="utf-8-sig"
    )
    ir_symbol = getattr(args, "ir_symbol", None)
    ir_frame = pd.DataFrame()
    if ir_symbol:
        try:
            ir_frame = fetch_macro_ir(start, end, symbol=ir_symbol)
        except Exception as exc:
            print(
                f"[WARN] 利率诊断不可用（{type(exc).__name__}）"
            )
        if not ir_frame.empty:
            ir_frame = ir_frame.copy()
            ir_frame["research_status"] = "RESEARCH_ONLY"
            ir_frame.to_csv(
                out / "interest_rate_diagnostic.csv",
                index=False,
                encoding="utf-8-sig",
            )

    fingerprints = {
        "returns_sha256": _frame_fingerprint(returns),
        "macro_sha256": _frame_fingerprint(macro),
    }
    if not ir_frame.empty:
        fingerprints["ir_sha256"] = _frame_fingerprint(ir_frame)
    diagnostic_metadata = {
        "config": {
            "requested_start": _date_tag(start),
            "requested_end": _date_tag(end),
            "long_change_days": DEFAULT_LONG_CHANGE_DAYS,
            "smooth_window": DEFAULT_SMOOTH_WINDOW,
            "hysteresis_days": DEFAULT_MIN_HOLD_DAYS,
            "cpi_publication_lag_days": CPI_PUB_LAG_DAYS,
            "gdp_publication_lag_days": GDP_PUB_LAG_DAYS,
            "ir_symbol": ir_symbol,
            "ir_used_for_quadrant": False,
        },
        "data_fingerprint": fingerprints,
        "software": {
            "skill_version": SKILL_VERSION,
            "source_sha256": _source_fingerprint(),
            "python": sys.version.split()[0],
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "panda_data": _package_version("panda_data"),
        },
        "limitations": [
            "RESEARCH_ONLY：仅供研究，不可直接用于实盘。",
            "宏观历史修订版本不可得，公布滞后不能消除修订值前视。",
            "利率序列仅作可选诊断，不参与增长×通胀象限。",
        ],
    }
    with open(
        out / "diagnostics_metadata.json", "w", encoding="utf-8"
    ) as handle:
        json.dump(
            diagnostic_metadata,
            handle,
            ensure_ascii=False,
            indent=2,
        )
    q_key, q_label = current_quadrant(regime)
    print(f"最新象限: {q_key} ({q_label})")
    _plot_regime(regime, out)
    print(f"诊断结果目录: {out}")
    return 0


# -------- 绘图 & 报告 ---------------------------------------------------

def _plot_backtest(result, out: Path) -> None:
    try:
        import matplotlib.pyplot as plt
    except Exception as e:
        log.warning(
            "matplotlib 不可用，跳过绘图（%s）",
            type(e).__name__,
        )
        return
    fig, axes = plt.subplots(2, 1, figsize=(11, 7), sharex=True)
    result.equity.plot(ax=axes[0], color="#1f77b4")
    axes[0].set_title("All Weather · Equity")
    axes[0].set_ylabel("Equity (1.0 start)")
    dd = result.equity / result.equity.cummax() - 1
    dd.plot(ax=axes[1], color="#d62728")
    axes[1].set_title("Drawdown")
    axes[1].set_ylabel("DD")
    axes[1].axhline(0, color="gray", lw=0.5)
    fig.tight_layout()
    fig.savefig(out / "equity.png", dpi=140)
    plt.close(fig)


def _plot_regime(regime, out: Path) -> None:
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return
    df = regime.diagnostics
    fig, axes = plt.subplots(2, 1, figsize=(11, 6), sharex=True)
    df["cpi_yoy"].plot(ax=axes[0], color="#ff7f0e", label="CPI YoY")
    axes[0].axhline(0, color="gray", lw=0.5)
    axes[0].legend()
    df["gdp_yoy"].plot(ax=axes[1], color="#2ca02c", label="GDP YoY")
    axes[1].axhline(0, color="gray", lw=0.5)
    axes[1].legend()
    fig.tight_layout()
    fig.savefig(out / "regime.png", dpi=140)
    plt.close(fig)


def _write_report(result, weights, used: dict, out: Path,
                  run_meta: Optional[dict] = None) -> None:
    m = result.metrics
    lines = [
        "# RESEARCH_ONLY · All Weather 回测报告",
        "",
        "> 仅供研究验证，不构成投资建议或实盘许可，不可直接用于实盘。",
        "",
        f"- 期间: **{m['start']} → {m['end']}**（{m['n_days']} 交易日）",
        f"- CAGR: **{m['cagr']:.2%}**",
        f"- 年化收益 / 波动: {m['ann_return']:.2%} / {m['ann_vol']:.2%}",
        f"- Sharpe: **{m['sharpe']:.2f}**",
        f"- 最大回撤: **{m['max_drawdown']:.2%}**",
        f"- 年化换手: {m['avg_turnover_annual']:.2f} × / 年",
        f"- 成本口径: 执行日实际持仓到目标权重的 L1 换手 × "
        f"{m['cost_bps']:.1f} bp，单次扣除",
        f"- 再平衡 / 波动窗口: {(run_meta or {}).get('run_config', {}).get('rebalance', '未知')} / "
        f"{(run_meta or {}).get('run_config', {}).get('vol_window', '未知')} 日",
        "",
        "## 使用的 symbol",
    ]
    for k, v in used.items():
        lines.append(f"- {k}: `{v}`")
    risk = (run_meta or {}).get("risk_contribution", {})
    lines.extend(["", "## 60 日协方差风险贡献", ""])
    for key, value in risk.get("by_asset", {}).items():
        lines.append(f"- {key}: {value:.2%}")
    if risk.get("max_contribution") is not None:
        lines.append(
            f"- 最大绝对风险贡献: {risk['max_contribution']:.2%}"
        )
    if risk.get("herfindahl") is not None:
        lines.append(f"- 风险贡献集中度（HHI）: {risk['herfindahl']:.4f}")
    if (
        risk.get("max_contribution") is not None
        and risk["max_contribution"] > 0.50
    ):
        lines.append(
            "- **警示：风险贡献较集中；默认反波动率方法不等于严格等风险。**"
        )
    lines.extend([
        "",
        "## 决策与执行核验文件",
        "",
        "- `decision_dates.csv`：每个目标决策日及样本内下一共同交易日；"
        "样本末日尚无下一日时留空。",
        "- `target_weights.csv`：逐个决策日的五类资产目标权重及对应的"
        "样本内下一共同交易日。",
        "- `executed_rebalances.csv`：通过换手门槛后实际发生交易的日期。",
    ])
    lines.append("")
    lines.append("## 按象限收益归因")
    lines.append("")
    if not result.by_quadrant.empty:
        lines.append(result.by_quadrant.to_markdown())
    lines.extend(["", "## 重要限制"])
    for item in (run_meta or {}).get("limitations", []):
        lines.append(f"- {item}")
    lines.extend(["", "## 复现信息", "", "### 数据指纹", ""])
    for key, value in (run_meta or {}).get("data_fingerprint", {}).items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "### 软件版本", ""])
    for key, value in (run_meta or {}).get("software", {}).items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "### 完整运行参数", "", "```json",
                  json.dumps((run_meta or {}).get("run_config", {}),
                             ensure_ascii=False, indent=2), "```"])
    lines.append("")
    lines.append("![Equity](equity.png)")
    with open(out / "report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# -------- 入口 ----------------------------------------------------------

def _positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("value must be positive")
    return parsed


def _nonnegative_float(value: str) -> float:
    parsed = float(value)
    if not np.isfinite(parsed) or parsed < 0:
        raise argparse.ArgumentTypeError(
            "value must be finite and nonnegative"
        )
    return parsed


def _health_timeout(value: str) -> float:
    parsed = float(value)
    if not np.isfinite(parsed) or not 0.1 <= parsed <= 30.0:
        raise argparse.ArgumentTypeError("value must be between 0.1 and 30")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="dalio-all-weather")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser(
        "health-check",
        help="检查 Python、SDK、服务方 HTTPS 和凭证配置",
    )
    s.add_argument("--timeout", type=_health_timeout, default=5.0)
    s.add_argument(
        "--transport-only",
        action="store_true",
        help="只检查运行环境与 HTTPS，不要求已配置凭证",
    )
    s.set_defaults(func=cmd_health_check)

    s = sub.add_parser("check-login")
    s.set_defaults(func=cmd_check_login)

    s = sub.add_parser("current-allocation")
    s.add_argument("--start", default=None)
    s.add_argument("--end", default=None)
    s.set_defaults(func=cmd_current_allocation)

    s = sub.add_parser("backtest")
    s.add_argument("--start", required=True)
    s.add_argument("--end", default=None)
    s.add_argument("--rebalance", default="Q", choices=["W", "M", "Q"])
    s.add_argument("--vol-window", type=_positive_int, default=60)
    s.add_argument("--cost-bps", type=_nonnegative_float, default=5.0)
    s.add_argument(
        "--turnover-threshold",
        type=_nonnegative_float,
        default=DEFAULT_TURNOVER_THRESHOLD,
    )
    s.add_argument(
        "--rebalance-on-regime-change",
        action="store_true",
        help="also form a new target when the regime changes",
    )
    s.set_defaults(func=cmd_backtest)

    s = sub.add_parser("diagnose-regime")
    s.add_argument("--start", default=None)
    s.add_argument("--end", default=None)
    s.add_argument(
        "--ir-symbol",
        default=None,
        help="optional explicit panda_data interest-rate symbol",
    )
    s.set_defaults(func=cmd_diagnose_regime)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    _load_dotenv()
    if args.cmd not in {"health-check", "check-login"}:
        try:
            _login()
        except Exception as exc:
            print(
                f"[ERROR] 启动检查或登录失败（{type(exc).__name__}）",
                file=sys.stderr,
            )
            return 1
    return args.func(args) or 0


if __name__ == "__main__":
    raise SystemExit(main())
