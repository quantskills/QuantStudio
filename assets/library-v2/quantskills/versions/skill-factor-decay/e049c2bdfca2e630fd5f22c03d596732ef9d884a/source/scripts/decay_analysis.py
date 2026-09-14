#!/usr/bin/env python
"""
因子衰减分析 — 多期限 IC 衰减 + Bootstrap 半衰期 + 换手衰减 + 分组收益衰减
用法: python scripts/decay_analysis.py [--factor-dir data/factors] [--report-dir data/decay_reports]
"""
import sys
from pathlib import Path
import argparse
import json
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from scipy.optimize import curve_fit

_SCRIPT_DIR = Path(__file__).resolve().parent
_SKILLS_DIR = _SCRIPT_DIR.parent.parent
_PANDADATA_SCRIPTS = _SKILLS_DIR / "skill-pandadata-api" / "scripts"
if _PANDADATA_SCRIPTS.is_dir():
    sys.path.insert(0, str(_PANDADATA_SCRIPTS))

HORIZONS = [1, 3, 5, 10, 20]
N_BOOTSTRAP = 1000
MIN_DAILY_SAMPLES = 30
BLOCK_SIZE = 5


def daily_rank_ic(signal: pd.Series, fwd_ret: pd.Series) -> pd.Series:
    df = pd.DataFrame({"signal": signal, "fwd_ret": fwd_ret})
    results = {}
    for d, grp in df.groupby(level="date"):
        grp = grp.dropna()
        if len(grp) < MIN_DAILY_SAMPLES:
            results[d] = np.nan
            continue
        ic, _ = spearmanr(grp["signal"], grp["fwd_ret"])
        results[d] = ic
    return pd.Series(results, name="rank_ic")


def daily_turnover(signal: pd.Series, top_pct: float = 0.2) -> float:
    dates = sorted(signal.index.get_level_values("date").unique())
    turnovers = []
    for i in range(len(dates) - 1):
        d0, d1 = dates[i], dates[i + 1]
        s0 = signal.loc[d0].dropna()
        s1 = signal.loc[d1].dropna()
        common = s0.index.intersection(s1.index)
        if len(common) < MIN_DAILY_SAMPLES:
            continue
        r0 = s0.loc[common].rank(pct=True)
        r1 = s1.loc[common].rank(pct=True)
        top_mask = (r0 >= (1 - top_pct)) | (r1 >= (1 - top_pct))
        to = (r0[top_mask] - r1[top_mask]).abs().mean()
        turnovers.append(to)
    return np.mean(turnovers) if turnovers else np.nan


def fit_exponential(horizons, ic_means):
    def model(h, ic0, tau):
        return ic0 * np.exp(-h / tau)
    try:
        popt, _ = curve_fit(model, horizons, ic_means,
                            p0=[ic_means[0], 10.0],
                            bounds=([-1, 1], [1, 200]), maxfev=10000)
        ic0, tau = popt
        r2 = 1 - np.sum((ic_means - model(horizons, *popt))**2) / np.sum((ic_means - ic_means.mean())**2)
        return ic0, tau, tau * np.log(2), r2
    except Exception:
        return np.nan, np.nan, np.nan, np.nan


def bootstrap_half_life(ic_dict: dict, n_bootstrap=N_BOOTSTRAP):
    horizons = np.array(sorted(ic_dict.keys()))
    ic_df = pd.DataFrame(ic_dict).dropna()
    n_dates = len(ic_df)
    if n_dates < 60:
        return {"tau": np.inf, "ci_lower": np.inf, "ci_upper": np.inf, "n_valid": 0}

    finite_taus = []
    n_blocks = max(1, n_dates // BLOCK_SIZE)
    for _ in range(n_bootstrap):
        block_starts = np.random.choice(n_dates - BLOCK_SIZE + 1, size=n_blocks, replace=True)
        indices = []
        for start in block_starts:
            indices.extend(range(start, min(start + BLOCK_SIZE, n_dates)))
        indices = indices[:n_dates]
        sample = ic_df.iloc[indices]
        ic_means = sample.mean().values
        dominant_sign = np.sign(ic_means[np.argmax(np.abs(ic_means))])
        ic_for_fit = ic_means * dominant_sign
        valid = ic_for_fit > 1e-10
        if valid.sum() < 2:
            continue
        slope, _ = np.polyfit(horizons[valid], np.log(ic_for_fit[valid]), 1)
        if slope >= 0:
            continue
        tau = -1.0 / slope
        hl = tau * np.log(2)
        if 0 < hl < 500:
            finite_taus.append(hl)

    if len(finite_taus) < 100:
        return {"tau": np.median(finite_taus) if finite_taus else np.inf,
                "ci_lower": np.inf, "ci_upper": np.inf, "n_valid": len(finite_taus)}

    finite_taus = np.array(finite_taus)
    return {"tau": np.median(finite_taus),
            "ci_lower": np.percentile(finite_taus, 2.5),
            "ci_upper": np.percentile(finite_taus, 97.5),
            "n_valid": len(finite_taus)}


def compute_q_spread(signal, fwd_ret, n_groups=5):
    df = pd.DataFrame({"signal": signal, "fwd_ret": fwd_ret}).dropna()
    spreads, q5_rets, q1_rets = [], [], []
    for d, grp in df.groupby(level="date"):
        if len(grp) < MIN_DAILY_SAMPLES:
            continue
        grp = grp.copy()
        grp["group"] = pd.qcut(grp["signal"], n_groups, labels=False, duplicates="drop")
        if grp["group"].nunique() < n_groups:
            continue
        q5_rets.append(grp[grp["group"] == n_groups - 1]["fwd_ret"].mean())
        q1_rets.append(grp[grp["group"] == 0]["fwd_ret"].mean())
        spreads.append(q5_rets[-1] - q1_rets[-1])
    return np.mean(spreads), np.mean(q5_rets), np.mean(q1_rets)


def compute_forward_returns(start_date="20201201", end_date="20250131", indicator="000300"):
    """从 Pandadata 拉取日线并计算多期限 forward returns"""
    try:
        from pandadata_runtime import init_pandadata
    except ImportError:
        print('❌ 无法导入 pandadata_runtime。请确保 skill-pandadata-api 已安装。')
        sys.exit(1)
    pd_api = init_pandadata()

    raw = pd_api.get_stock_daily(
        start_date=start_date, end_date=end_date,
        fields=[], indicator=indicator, st=False,
    )
    raw["date"] = pd.to_datetime(raw["date"], format="%Y%m%d")
    raw.columns = [c.lower() for c in raw.columns]
    if "trade_status" in raw.columns:
        raw = raw[raw["trade_status"] == 0]
    raw = raw.sort_values(["symbol", "date"])

    for h in HORIZONS:
        raw[f"forward_ret_{h}d"] = raw.groupby("symbol")["close"].shift(-h) / raw["close"] - 1

    return raw.set_index(["date", "symbol"])


def load_factors(factor_dir: Path) -> dict:
    factors = {}
    for fp in sorted(factor_dir.glob("F*.parquet")):
        df = pd.read_parquet(fp)
        df["date"] = pd.to_datetime(df["date"])
        factors[fp.stem] = df.set_index(["date", "symbol"])["factor_value"]
    return factors


def make_equal_weight_composite(factor_signals: dict) -> pd.Series:
    all_dates = sorted(set().union(*[set(s.index.get_level_values("date")) for s in factor_signals.values()]))
    daily_chunks = []
    for d in all_dates:
        day_vals = []
        for s in factor_signals.values():
            try:
                day_s = s.loc[d].dropna()
                day_s = (day_s - day_s.mean()) / day_s.std()
                day_vals.append(day_s)
            except (KeyError, AttributeError):
                continue
        if len(day_vals) < 2:
            continue
        composite = pd.concat(day_vals, axis=1).mean(axis=1)
        composite.index = pd.MultiIndex.from_tuples(
            [(d, sym) for sym in composite.index], names=["date", "symbol"])
        daily_chunks.append(composite)
    result = pd.concat(daily_chunks)
    result.name = "factor_value"
    return result


def analyze_factor(name, signal, fwd_rets):
    """完整衰减分析，返回 report dict"""
    idx = signal.dropna().index.intersection(fwd_rets.dropna(how="all").index)
    signal = signal.loc[idx]

    ic_results = {}
    for h in HORIZONS:
        col = f"forward_ret_{h}d"
        ic_results[h] = daily_rank_ic(signal, fwd_rets[col])

    ic_means = np.array([ic_results[h].mean() for h in HORIZONS])
    ic0, tau, hl_exp, r2 = fit_exponential(np.array(HORIZONS), ic_means)
    bs = bootstrap_half_life(ic_results)

    # 半衰期判定
    hl = bs["tau"]
    if np.isinf(hl) or hl < 2:
        freq, quality = 1, "poor"
    elif hl < 5:
        freq, quality = 3, "moderate"
    elif hl < 15:
        freq, quality = 5, "good"
    elif hl < 30:
        freq, quality = 10, "excellent"
    else:
        freq, quality = 20, "exceptional"

    # 换手衰减
    to_decay = {}
    all_dates = sorted(signal.index.get_level_values("date").unique())
    for interval in [1, 3, 5, 10, 20]:
        sampled = all_dates[::interval]
        mask = signal.index.get_level_values("date").isin(sampled)
        to_decay[interval] = daily_turnover(signal[mask])

    # 分组收益
    spread_results = {}
    for h in HORIZONS:
        col = f"forward_ret_{h}d"
        sp, q5, q1 = compute_q_spread(signal, fwd_rets[col])
        spread_results[h] = {"spread": sp, "q5": q5, "q1": q1}

    warnings = []
    spreads_arr = np.array([spread_results[h]["spread"] for h in HORIZONS])
    if not np.all(np.diff(np.abs(spreads_arr)) <= 0):
        warnings.append("IC 不单调递减（可能为方向反转，见 sign-reversal 说明）")

    return {
        "factor_name": name,
        "ic_means": {str(h): float(ic_results[h].mean()) for h in HORIZONS},
        "ic_stds": {str(h): float(ic_results[h].std()) for h in HORIZONS},
        "half_life": bs,
        "model": "exponential" if r2 > 0.5 else "nonparametric",
        "r_squared": float(r2) if np.isfinite(r2) else 0.0,
        "turnover_decay": to_decay,
        "spread_decay": {str(h): spread_results[h] for h in HORIZONS},
        "recommendation": {"rebalance_frequency_days": freq, "quality": quality},
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser(description="因子衰减分析")
    parser.add_argument("--factor-dir", default="data/factors",
                        help="因子目录（原始因子或正交化后因子，相对于工作目录或绝对路径）")
    parser.add_argument("--report-dir", default="data/decay_reports",
                        help="报告输出目录")
    parser.add_argument("--max-factors", type=int, default=3,
                        help="最多分析的单个因子数量（0=仅合成因子, -1=全部）")
    parser.add_argument("--indicator", default="000300",
                        help="Pandadata 股票池指数代码 (默认 000300=沪深300)")
    parser.add_argument("--start-date", default="20201201",
                        help="Pandadata 起始日期 YYYYMMDD")
    parser.add_argument("--end-date", default="20250131",
                        help="Pandadata 结束日期 YYYYMMDD")
    args = parser.parse_args()

    factor_dir = Path(args.factor_dir)
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("因子衰减分析 (Factor Decay Analysis)")
    print("=" * 60)

    print("\n[1] 计算多期限 forward returns...")
    fwd_rets = compute_forward_returns(args.start_date, args.end_date, args.indicator)
    print(f"    {len(fwd_rets)} 行, horizons={HORIZONS}")

    print(f"\n[2] 加载因子: {factor_dir}")
    factors = load_factors(factor_dir)
    if not factors:
        print(f"❌ 未找到因子文件: {factor_dir}")
        return
    print(f"    {len(factors)} 个因子")

    # 等权合成
    print("\n[3] 创建等权合成因子...")
    composite = make_equal_weight_composite(factors)
    print(f"    {len(composite)} 个样本")

    targets = {"composite_equal": composite}
    if args.max_factors != 0:
        n = None if args.max_factors < 0 else args.max_factors
        for k in list(factors.keys())[:n]:
            targets[k] = factors[k]

    print(f"\n[4] 分析 {len(targets)} 个目标...")
    all_reports = {}
    for name, signal in targets.items():
        print(f"\n  ── {name} ──")
        report = analyze_factor(name, signal, fwd_rets)
        all_reports[name] = report

        ic_str = "  ".join(f"IC({h}d)={report['ic_means'][str(h)]:+.5f}" for h in HORIZONS)
        hl = report["half_life"]
        print(f"    {ic_str}")
        print(f"    τ₀.₅={hl['tau']:.1f}d  95%CI=[{hl['ci_lower']:.1f}, {hl['ci_upper']:.1f}]  "
              f"quality={report['recommendation']['quality']}  rebalance={report['recommendation']['rebalance_frequency_days']}d")

        if report["warnings"]:
            for w in report["warnings"]:
                print(f"    ⚠️  {w}")

        # 保存
        json_path = report_dir / f"decay_report_{name}.json"
        json.dump(report, json_path.open("w"), indent=2, ensure_ascii=False, default=str)

    # 汇总
    print(f"\n{'='*60}")
    print(f"{'因子':<30s} {'τ₀.₅':>8s} {'CI':>18s} {'质量':>10s}")
    print("-" * 60)
    for name, r in all_reports.items():
        hl = r["half_life"]
        print(f"{name:<30s} {hl['tau']:>8.1f} [{hl['ci_lower']:>7.1f},{hl['ci_upper']:>7.1f}] {r['recommendation']['quality']:>10s}")

    print(f"\n✅ 报告目录: {report_dir}")


if __name__ == "__main__":
    main()
