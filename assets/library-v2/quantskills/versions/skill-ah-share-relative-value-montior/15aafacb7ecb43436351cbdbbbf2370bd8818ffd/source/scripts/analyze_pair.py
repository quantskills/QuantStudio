#!/usr/bin/env python3
"""Analyze one A/H historical pair from a normalized CSV using stdlib only."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from datetime import datetime
from pathlib import Path

REQUIRED = ("date", "a_price_cny", "h_price_hkd", "fx_hkd_cny")
WINDOWS = (20, 60, 250)


def parse_date(value: str):
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"unsupported date: {value}")


def fnum(value, field):
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"invalid {field}: {value!r}")
    if not math.isfinite(v) or v <= 0:
        raise ValueError(f"{field} must be positive: {value!r}")
    return v


def percentile(values, x):
    if not values:
        return None
    return sum(v <= x for v in values) / len(values)


def mad(values):
    if not values:
        return None
    med = statistics.median(values)
    return statistics.median(abs(v - med) for v in values)


def corr(xs, ys):
    n = min(len(xs), len(ys))
    if n < 3:
        return None
    xs, ys = xs[:n], ys[:n]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    dx = [x - mx for x in xs]
    dy = [y - my for y in ys]
    den = math.sqrt(sum(x*x for x in dx) * sum(y*y for y in dy))
    if den == 0:
        return None
    return sum(x*y for x, y in zip(dx, dy)) / den


def window_stats(values, window):
    vals = values[-window:]
    min_required = max(10, window // 2)
    if len(vals) < min_required:
        return None
    current = vals[-1]
    mean = statistics.mean(vals)
    median = statistics.median(vals)
    sd = statistics.stdev(vals) if len(vals) >= 2 else 0.0
    z = None if sd == 0 else (current - mean) / sd
    m = mad(vals)
    rz = None if not m else 0.67448975 * (current - median) / m
    return {
        "n": len(vals),
        "mean_pct": mean * 100,
        "median_pct": median * 100,
        "percentile": percentile(vals, current),
        "z_score": z,
        "robust_z": rz,
    }


def lead_lag(rows, max_obs=120):
    if len(rows) < 42:
        return {"n": 0, "label": "insufficient-history"}
    a_ret, h_ret = [], []
    for prev, cur in zip(rows, rows[1:]):
        a_ret.append(math.log(cur["a"] / prev["a"]))
        h_ret.append(math.log(cur["h"] / prev["h"]))
    a_ret, h_ret = a_ret[-max_obs:], h_ret[-max_obs:]
    if len(a_ret) < 40:
        return {"n": len(a_ret), "label": "insufficient-history"}
    same = corr(a_ret, h_ret)
    h_to_a = corr(h_ret[:-1], a_ret[1:])
    a_to_h = corr(a_ret[:-1], h_ret[1:])
    if h_to_a is None or a_to_h is None:
        label = "insufficient-variation"
        score = None
    else:
        score = h_to_a - a_to_h
        label = "h-leads-a" if score >= 0.08 else "a-leads-h" if score <= -0.08 else "balanced"
    return {
        "n": len(a_ret),
        "same_day_corr": same,
        "h_to_next_a_corr": h_to_a,
        "a_to_next_h_corr": a_to_h,
        "lead_score": score,
        "label": label,
        "caveat": "Daily close proxy only; Hong Kong normally closes later than mainland China.",
    }


def choose_reference(stats_map):
    for w in (250, 60, 20):
        if stats_map.get(str(w)):
            return str(w), stats_map[str(w)]
    return None, None


def classify(ref):
    if not ref:
        return "insufficient-history", 0.0, None
    z = ref.get("robust_z")
    if z is None:
        z = ref.get("z_score")
    p = ref.get("percentile")
    if z is None:
        if p is None:
            return "insufficient-history", 0.0, None
        if p >= 0.95:
            state = "extreme-a-premium"
        elif p <= 0.05:
            state = "extreme-a-discount"
        else:
            state = "balanced"
        score = 30 * abs(p - 0.5) * 2
        return state, round(score, 1), None
    if z >= 2:
        state = "extreme-a-premium"
    elif z >= 1:
        state = "elevated-a-premium"
    elif z <= -2:
        state = "extreme-a-discount"
    elif z <= -1:
        state = "elevated-a-discount"
    else:
        state = "balanced"
    z_component = 70 * min(abs(z) / 3, 1)
    p_component = 0 if p is None else 30 * abs(p - 0.5) * 2
    return state, round(min(100, z_component + p_component), 1), z


def load_rows(path, share_ratio):
    warnings = []
    by_date = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"missing columns: {', '.join(missing)}")
        for line_no, raw in enumerate(reader, start=2):
            try:
                d = parse_date(raw["date"])
                a = fnum(raw["a_price_cny"], "a_price_cny")
                h = fnum(raw["h_price_hkd"], "h_price_hkd")
                fx = fnum(raw["fx_hkd_cny"], "fx_hkd_cny")
            except ValueError as e:
                warnings.append(f"line {line_no}: {e}; row skipped")
                continue
            stale = 0
            if raw.get("fx_stale_days") not in (None, ""):
                try:
                    stale = int(float(raw["fx_stale_days"]))
                except ValueError:
                    warnings.append(f"line {line_no}: invalid fx_stale_days; treated as 0")
                    stale = 0
            if d in by_date:
                warnings.append(f"duplicate date {d.isoformat()}: last row kept")
            h_equiv = h * fx * share_ratio
            by_date[d] = {
                "date": d,
                "a": a,
                "h": h,
                "fx": fx,
                "fx_stale_days": stale,
                "premium": a / h_equiv - 1,
            }
    rows = [by_date[d] for d in sorted(by_date)]
    if not rows:
        raise ValueError("no valid rows")
    return rows, warnings


def infer_identity(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        try:
            first = next(reader)
        except StopIteration:
            return {"company": "", "a_code": "", "h_code": ""}
    return {
        "company": first.get("company", ""),
        "a_code": first.get("a_code", ""),
        "h_code": first.get("h_code", ""),
    }


def analyze(path, share_ratio=1.0, company="", a_code="", h_code=""):
    if share_ratio <= 0:
        raise ValueError("share_ratio must be positive")
    identity = infer_identity(path)
    company = company or identity["company"]
    a_code = a_code or identity["a_code"]
    h_code = h_code or identity["h_code"]
    rows, warnings = load_rows(path, share_ratio)
    premiums = [r["premium"] for r in rows]
    stats_map = {str(w): window_stats(premiums, w) for w in WINDOWS}
    ref_window, ref = choose_reference(stats_map)
    state, score, z_ref = classify(ref)
    current = rows[-1]
    change_1 = (premiums[-1] - premiums[-2]) * 100 if len(premiums) >= 2 else None
    change_5 = (premiums[-1] - premiums[-6]) * 100 if len(premiums) >= 6 else None
    flags = []
    if state == "extreme-a-premium": flags.append("extreme-a-premium")
    if state == "extreme-a-discount": flags.append("extreme-a-discount")
    if any(r["fx_stale_days"] > 1 for r in rows[-20:]): flags.append("recent-fx-staleness")
    if any(r["fx_stale_days"] > 3 for r in rows): warnings.append("FX staleness above 3 days exists in input history")
    diffs = [b-a for a,b in zip(premiums, premiums[1:])]
    if change_5 is not None and len(diffs) >= 30:
        recent = diffs[-60:]
        sd = statistics.stdev(recent) if len(recent) >= 2 else 0.0
        threshold_pp = 2 * sd * math.sqrt(5) * 100
        if threshold_pp > 0 and abs(change_5) > threshold_pp:
            flags.append("rapid-premium-widening" if change_5 > 0 else "rapid-premium-compression")
    ll = lead_lag(rows)
    confidence = "high" if len(rows) >= 250 and not warnings else "medium" if len(rows) >= 60 else "low"
    result = {
        "identity": {"company": company, "a_code": a_code, "h_code": h_code},
        "input": {"path": str(path), "valid_observations": len(rows), "share_ratio": share_ratio},
        "current": {
            "date": current["date"].isoformat(),
            "a_price_cny": current["a"],
            "h_price_hkd": current["h"],
            "fx_hkd_cny": current["fx"],
            "h_equivalent_cny": current["h"] * current["fx"] * share_ratio,
            "premium_pct": current["premium"] * 100,
            "premium_change_1obs_pp": change_1,
            "premium_change_5obs_pp": change_5,
        },
        "windows": stats_map,
        "reference_window": int(ref_window) if ref_window else None,
        "reference_z": z_ref,
        "relative_value_state": state,
        "dislocation_score": score,
        "lead_lag_proxy": ll,
        "flags": flags,
        "warnings": warnings,
        "confidence": confidence,
        "interpretation_boundary": "Historical extremity is not proof of arbitrage or future convergence.",
    }
    return result


def fmt(v, digits=2):
    return "n/a" if v is None else f"{v:.{digits}f}"


def to_markdown(r):
    c = r["current"]
    ident = r["identity"]
    lines = [
        "# A/H Relative Value Report",
        "",
        f"- Company: {ident.get('company') or 'n/a'}",
        f"- A / H code: {ident.get('a_code') or 'n/a'} / {ident.get('h_code') or 'n/a'}",
        f"- Observation: {c['date']}",
        f"- A price: {fmt(c['a_price_cny'])} CNY",
        f"- H price: {fmt(c['h_price_hkd'])} HKD",
        f"- HKD/CNY: {fmt(c['fx_hkd_cny'], 5)}",
        f"- Recomputed premium: **{fmt(c['premium_pct'])}%**",
        f"- Relative value state: **{r['relative_value_state']}**",
        f"- Dislocation score: **{fmt(r['dislocation_score'],1)} / 100**",
        f"- Confidence: {r['confidence']}",
        "",
        "## Historical context",
        "",
        "| Window | N | Median % | Percentile | Z | Robust Z |",
        "|---:|---:|---:|---:|---:|---:|",
    ]
    for w in WINDOWS:
        s = r["windows"].get(str(w))
        if s:
            lines.append(f"| {w} | {s['n']} | {fmt(s['median_pct'])} | {fmt(s['percentile']*100,1)}% | {fmt(s['z_score'])} | {fmt(s['robust_z'])} |")
        else:
            lines.append(f"| {w} | n/a | n/a | n/a | n/a | n/a |")
    ll = r["lead_lag_proxy"]
    lines += [
        "",
        "## Daily lead-lag proxy",
        "",
        f"- Label: {ll.get('label')}",
        f"- Same-day correlation: {fmt(ll.get('same_day_corr'))}",
        f"- H(t) -> A(t+1): {fmt(ll.get('h_to_next_a_corr'))}",
        f"- A(t) -> H(t+1): {fmt(ll.get('a_to_next_h_corr'))}",
        f"- Lead score: {fmt(ll.get('lead_score'))}",
        "- Caveat: daily closes are asynchronous because Hong Kong normally closes later.",
        "",
        "## Flags",
        "",
    ]
    lines += [f"- {x}" for x in r["flags"]] or ["- none"]
    if r["warnings"]:
        lines += ["", "## Data warnings", ""] + [f"- {x}" for x in r["warnings"]]
    lines += [
        "",
        "**Research/education only; not investment advice and not a claim of executable arbitrage.**",
    ]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--company", default="")
    ap.add_argument("--a-code", default="")
    ap.add_argument("--h-code", default="")
    ap.add_argument("--share-ratio", type=float, default=1.0)
    ap.add_argument("--json", dest="json_path")
    ap.add_argument("--md", dest="md_path")
    args = ap.parse_args()
    result = analyze(args.csv_path, args.share_ratio, args.company, args.a_code, args.h_code)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    md = to_markdown(result)
    if args.json_path:
        Path(args.json_path).write_text(text + "\n", encoding="utf-8")
    if args.md_path:
        Path(args.md_path).write_text(md, encoding="utf-8")
    if not args.json_path and not args.md_path:
        print(md, end="")

if __name__ == "__main__":
    main()
