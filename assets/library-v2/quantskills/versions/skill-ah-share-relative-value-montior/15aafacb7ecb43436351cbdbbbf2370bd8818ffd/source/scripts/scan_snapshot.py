#!/usr/bin/env python3
"""Scan a normalized current A/H snapshot and recompute premiums."""

from __future__ import annotations
import argparse, csv, json, math, statistics
from pathlib import Path

REQ = ("company","h_code","h_price_hkd","a_code","a_price_cny")

def num(v):
    x=float(v)
    if not math.isfinite(x) or x<=0: raise ValueError
    return x

def quantile(vals, q):
    vals=sorted(vals)
    if not vals: return None
    pos=(len(vals)-1)*q
    lo=int(math.floor(pos)); hi=int(math.ceil(pos))
    if lo==hi: return vals[lo]
    return vals[lo]*(hi-pos)+vals[hi]*(pos-lo)

def scan(path, fx_override=None, share_ratio=1.0, top=10):
    if share_ratio<=0: raise ValueError("share_ratio must be positive")
    rows=[]; warnings=[]
    with open(path, newline="", encoding="utf-8-sig") as f:
        rd=csv.DictReader(f)
        missing=[c for c in REQ if c not in (rd.fieldnames or [])]
        if missing: raise ValueError("missing columns: "+", ".join(missing))
        if fx_override is None and "fx_hkd_cny" not in (rd.fieldnames or []):
            raise ValueError("fx_hkd_cny column required unless --fx is supplied")
        for n,r in enumerate(rd,start=2):
            try:
                a=num(r["a_price_cny"]); h=num(r["h_price_hkd"])
                fx=num(fx_override if fx_override is not None else r["fx_hkd_cny"])
            except Exception:
                warnings.append(f"line {n}: invalid price/fx; skipped"); continue
            premium=(a/(h*fx*share_ratio)-1)*100
            source=None; delta=None
            if r.get("source_premium_pct") not in (None,""):
                try:
                    source=float(r["source_premium_pct"]); delta=premium-source
                except ValueError: pass
            rows.append({
                "company":r.get("company",""),"a_code":r.get("a_code",""),"h_code":r.get("h_code",""),
                "a_price_cny":a,"h_price_hkd":h,"fx_hkd_cny":fx,"premium_pct":premium,
                "source_premium_pct":source,"source_delta_pp":delta,
            })
    if not rows: raise ValueError("no valid rows")
    ps=[r["premium_pct"] for r in rows]
    discrepancies=[r for r in rows if r["source_delta_pp"] is not None and abs(r["source_delta_pp"])>=0.5]
    result={
        "valid_pairs":len(rows),"share_ratio":share_ratio,
        "premium_distribution":{"median_pct":statistics.median(ps),"p10_pct":quantile(ps,.1),"p90_pct":quantile(ps,.9),"dispersion_p90_p10_pp":quantile(ps,.9)-quantile(ps,.1)},
        "a_discount_count":sum(p<0 for p in ps),
        "highest_premiums":sorted(rows,key=lambda r:r["premium_pct"],reverse=True)[:top],
        "lowest_premiums":sorted(rows,key=lambda r:r["premium_pct"])[:top],
        "source_discrepancies":discrepancies,
        "warnings":warnings,
        "boundary":"Cross-sectional rank is not a historical extremity signal.",
    }
    return result

def md(r):
    d=r["premium_distribution"]
    out=["# A/H Snapshot Scan","",f"- Valid pairs: {r['valid_pairs']}",f"- Median premium: {d['median_pct']:.2f}%",f"- P10 / P90: {d['p10_pct']:.2f}% / {d['p90_pct']:.2f}%",f"- P90-P10 dispersion: {d['dispersion_p90_p10_pp']:.2f}pp",f"- A-share discounts: {r['a_discount_count']}","","## Highest premiums","","| Company | A | H | Premium |","|---|---|---|---:|"]
    out += [f"| {x['company']} | {x['a_code']} | {x['h_code']} | {x['premium_pct']:.2f}% |" for x in r['highest_premiums']]
    out += ["","## Lowest premiums","","| Company | A | H | Premium |","|---|---|---|---:|"]
    out += [f"| {x['company']} | {x['a_code']} | {x['h_code']} | {x['premium_pct']:.2f}% |" for x in r['lowest_premiums']]
    if r['source_discrepancies']:
        out += ["","## Source premium discrepancies","",f"Rows with >=0.5pp difference: {len(r['source_discrepancies'])}"]
    out += ["","Cross-sectional rank alone does not establish historical cheapness or richness.","","**Research/education only; not investment advice and not a claim of executable arbitrage.**"]
    return "\n".join(out)+"\n"

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("csv_path"); ap.add_argument("--fx",type=float); ap.add_argument("--share-ratio",type=float,default=1.0); ap.add_argument("--top",type=int,default=10); ap.add_argument("--json",dest="json_path"); ap.add_argument("--md",dest="md_path"); args=ap.parse_args()
    r=scan(args.csv_path,args.fx,args.share_ratio,args.top); j=json.dumps(r,ensure_ascii=False,indent=2); m=md(r)
    if args.json_path: Path(args.json_path).write_text(j+"\n",encoding="utf-8")
    if args.md_path: Path(args.md_path).write_text(m,encoding="utf-8")
    if not args.json_path and not args.md_path: print(m,end="")
if __name__=="__main__": main()
