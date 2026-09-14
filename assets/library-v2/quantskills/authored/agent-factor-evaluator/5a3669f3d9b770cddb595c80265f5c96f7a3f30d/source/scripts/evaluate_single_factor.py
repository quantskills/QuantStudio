#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
evaluate_single_factor.py — 单因子截面有效性评估主脚本。

按 skill-factor-evaluate 的标准 6 步流程实现：
  1. 信号契约校验（截面规模 / 均值 / std / NaN 占比）
  2. 双 IC 时序（rank IC + Pearson IC 同时算并对照，IC_IR 年化）
  3. 多头回测（T+1 开盘买 Top 10%、等权、双边成本、T+1+H 卖出）
  4. 分组单调性（5 或 10 分位）
  5. 年化双边换手率
  6. 归一加权主分（v2 公式）

注意：
- 本脚本是随 Agent 资产附带的参考实现；运行 Agent 时必须优先调用
  skill-factor-evaluate 锁定的 primary_score()（唯一真理来源），
  本文件中的 primary_score() 与 references/primary-score.md 的 v2 公式逐行一致，
  禁止另写"近似版"。
- 不处理分红除权除息 / 配股 / 重大事件停牌；涨跌停 / 停牌按截面剔除处理。
- 输出仅反映历史数据 + 标准化假设下的统计表现，不代表未来表现。

用法：
  python evaluate_single_factor.py --compute-signal \
      --panel output/panel_000300_20220101_20231231.parquet \
      --factor momentum_20 \
      --out-signal output/factor_signal_momentum_20.parquet

  python evaluate_single_factor.py --evaluate \
      --panel output/panel_000300_20220101_20231231.parquet \
      --factor momentum_20 \
      --horizon 5 \
      --label-kind market_neutral \
      --n-groups 5 \
      --cost-bps 15 \
      --out-dir output \
      --pool-label 000300 \
      --expr "" \
      --period 20220101-20231231
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from datetime import datetime

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# 第 6 步：归一加权主分（v2 公式，skill-factor-evaluate 锁定）
# ---------------------------------------------------------------------------


def primary_score(rank_ic_ir, sharpe, ann_ret, max_dd, mono, ann_turnover):
    """归一加权主分（v2）。范围 ~[-2, +2]。

    与 skill-factor-evaluate references/primary-score.md 逐行一致：
      各分量先归一（1.0 ≈ "刚好不错"，2.0 ≈ "优秀"），再按权重相加（权重和=1.20）。
    """
    clip = lambda x, lo, hi: max(lo, min(hi, x))

    ic_term = clip(rank_ic_ir / 3.0, -2, 2)  # IC_IR=3 → 1；6 → 2
    shp_term = clip((sharpe + 0.5) / 1.0, -2, 2)  # Sharpe -0.5 → 0；+1.5 → 2
    ret_term = clip(ann_ret / 0.10, -2, 2)  # 年化 10% → 1；20% → 2
    mdd_term = clip(1 + max_dd / 0.30, -2, 1)  # MDD -30% → 0；浅 → +1
    mono_term = clip(mono, -1, 1)
    turn_term = -clip(ann_turnover / 30 - 1, 0, 3)  # 年换手 30 起惩罚

    # 加权（权重之和 = 1.20）
    return (
        0.20 * ic_term  # 截面有效性
        + 0.30 * shp_term  # 风险调整收益（主力）
        + 0.30 * ret_term  # 年化收益
        + 0.20 * mdd_term  # 最大回撤
        + 0.10 * mono_term  # 单调性
        + 0.10 * turn_term  # 换手惩罚
    ), {
        "ic_term": ic_term,
        "shp_term": shp_term,
        "ret_term": ret_term,
        "mdd_term": mdd_term,
        "mono_term": mono_term,
        "turn_term": turn_term,
    }


# ---------------------------------------------------------------------------
# 工具：面板 → 宽表
# ---------------------------------------------------------------------------


def _pivot(panel: pd.DataFrame, col: str) -> pd.DataFrame:
    """面板长表（date/symbol/...）→ [date × symbol] 宽表。"""
    return panel.pivot_table(index="date", columns="symbol", values=col, aggfunc="last").sort_index()


# ---------------------------------------------------------------------------
# 双 IC（rank IC + Pearson IC）
# ---------------------------------------------------------------------------


def _xs_corr(x: pd.DataFrame, y: pd.DataFrame) -> pd.Series:
    """逐日截面 Pearson。x、y 同 shape [date × symbol]。"""
    x = x.sub(x.mean(axis=1), axis=0)
    y = y.sub(y.mean(axis=1), axis=0)
    num = (x * y).sum(axis=1)
    den = np.sqrt((x**2).sum(axis=1) * (y**2).sum(axis=1))
    return num / den.replace(0, np.nan)


def both_ic(signal: pd.DataFrame, fwd_ret: pd.DataFrame) -> dict:
    """同时计算 rank IC 与 Pearson IC 时序（双 IC 对照）。"""
    aligned = signal.reindex_like(fwd_ret)
    rank_ic = _xs_corr(aligned.rank(axis=1), fwd_ret.rank(axis=1))
    pearson_ic = _xs_corr(aligned, fwd_ret)
    return {
        "rank_ic_mean": float(rank_ic.mean()),
        "rank_ic_ir": float(rank_ic.mean() / rank_ic.std() * np.sqrt(252)),
        "pearson_ic_mean": float(pearson_ic.mean()),
        "pearson_ic_ir": float(pearson_ic.mean() / pearson_ic.std() * np.sqrt(252)),
        "rank_ic_series": rank_ic,
        "pearson_ic_series": pearson_ic,
    }


# ---------------------------------------------------------------------------
# Forward Return（无未来函数）
# ---------------------------------------------------------------------------


def forward_return(open_p: pd.DataFrame, horizon: int, label_kind: str = "market_neutral") -> pd.DataFrame:
    """用 open[T+1+H] / open[T+1] - 1 算未来 H 期收益（T+1 开盘成交假设）。

    open_p.shift(-1).pct_change(H).shift(-H) 在索引 j 处取值：
      open[j+1+H] / open[j+1] - 1  ✓ 无未来函数
    """
    fwd = open_p.shift(-1).pct_change(horizon).shift(-horizon)
    if label_kind == "market_neutral":
        fwd = fwd.sub(fwd.mean(axis=1), axis=0)
    elif label_kind == "rank":
        fwd = fwd.rank(axis=1, pct=True)
    return fwd


# ---------------------------------------------------------------------------
# 多头回测：T+1 开盘买 Top 10%、等权、双边成本、T+1+H 卖出
# ---------------------------------------------------------------------------


def _tradeable_mask(panel: pd.DataFrame, date: pd.Timestamp) -> pd.Series:
    """当日可交易股票：剔除停牌（trade_status != 1）与涨停/跌停。"""
    day = panel[panel["date"] == date]
    if day.empty:
        return pd.Series(dtype=bool)
    mask = pd.Series(True, index=day["symbol"].values)
    if "trade_status" in day.columns:
        ts = day.set_index("symbol")["trade_status"]
        mask = mask & (ts.reindex(mask.index).fillna(0).astype(float) == 1)
    for flag in ("limit_up", "limit_down"):
        if flag in day.columns:
            lv = day.set_index("symbol")[flag]
            mask = mask & (lv.reindex(mask.index).fillna(0).astype(float) != 1)
    return mask


def long_topk_backtest(
    signal: pd.DataFrame,
    open_p: pd.DataFrame,
    panel: pd.DataFrame,
    top_frac: float = 0.10,
    cost_bps: float = 15.0,
) -> dict:
    """多头回测：每日按 T 日信号选 Top 10% 等权，T+1 开盘成交，双边成本按换手扣除。

    假设（研究标准化口径，非真实交易）：
      - 信号 T 日生成，T+1 开盘买入，持有至 T+1+H 后按新信号换仓（每日再平衡）。
      - 组合日收益 = 等权 Top10% 的 open-to-open 收益 − 双边成本 × 单边换手。
    """
    dates = signal.index
    tradeable = {
        d: _tradeable_mask(panel, d) for d in dates if _tradeable_mask(panel, d) is not None
    }
    weights = pd.DataFrame(0.0, index=dates, columns=signal.columns)
    for d in dates:
        day_sig = signal.loc[d].dropna()
        if day_sig.empty:
            continue
        tmask = tradeable.get(d)
        if tmask is not None and len(tmask):
            day_sig = day_sig[day_sig.index.isin(tmask.index[tmask.values])]
        if day_sig.empty:
            continue
        n_top = max(1, int(round(top_frac * len(day_sig))))
        top = day_sig.sort_values(ascending=False).head(n_top)
        weights.loc[d, top.index] = 1.0 / len(top)

    # open-to-open 单日收益：r[T+1] = open[T+2]/open[T+1] - 1
    open_next = open_p.shift(-1)
    open_next2 = open_p.shift(-2)
    ret_1d = (open_next2 / open_next - 1).reindex_like(weights)
    # 组合收益按 T 日权重 × T+1 单日收益
    gross = (weights.shift(1) * ret_1d).sum(axis=1) * (weights.shift(1) > 0).sum(axis=1).gt(0)
    # 更稳妥：逐日对齐（weights 用 T-1 生成，收益为 T 日 open-to-open）
    gross = (weights.shift(1) * ret_1d).sum(axis=1)
    turnover = weights.diff().abs().sum(axis=1) / 2.0  # 单边换手
    cost = (cost_bps / 1e4) * turnover  # 双边 15bp 按单边换手折半计费
    net = gross - cost

    nav = (1 + net.fillna(0)).cumprod()
    bench = (open_next / open_next.shift(1) - 1).mean(axis=1).reindex(nav.index).fillna(0)
    bench_nav = (1 + bench).cumprod()

    ann_ret = nav.iloc[-1] ** (252 / max(len(nav), 1)) - 1
    ann_vol = net.fillna(0).std() * np.sqrt(252)
    sharpe = (ann_ret / ann_vol) if ann_vol and not math.isnan(ann_vol) and ann_vol > 0 else 0.0
    cummax = nav.cummax()
    max_dd = float((nav / cummax - 1).min())

    return {
        "nav": nav,
        "bench_nav": bench_nav,
        "turnover_series": turnover,
        "annual_return": float(ann_ret),
        "annual_vol": float(ann_vol),
        "sharpe": float(sharpe),
        "max_drawdown": max_dd,
        "annual_turnover": float(turnover.mean() * 252),
        "top10_avg_daily_ret": float(gross.mean()),
    }


# ---------------------------------------------------------------------------
# 分组单调性
# ---------------------------------------------------------------------------


def monotonicity(signal: pd.DataFrame, fwd_ret: pd.DataFrame, n_groups: int = 5) -> tuple:
    """分组收益的单调度 ∈ [-1, 1]。1 = 完全单调上升，-1 = 完全单调下降。"""
    rank = signal.rank(axis=1, pct=True)
    group_rets = []
    for q in range(n_groups):
        lo, hi = q / n_groups, (q + 1) / n_groups
        mask = (rank > lo) & (rank <= hi)
        ret = fwd_ret.where(mask).mean(axis=1)
        group_rets.append(float(ret.mean()))
    rho = float(np.corrcoef(np.arange(n_groups), group_rets)[0, 1])
    if not np.isfinite(rho):
        rho = 0.0
    return rho, group_rets


# ---------------------------------------------------------------------------
# 信号契约校验
# ---------------------------------------------------------------------------


def validate_signal(signal: pd.DataFrame) -> dict:
    """校验截面规模 / 均值 / std / NaN 占比。"""
    nan_ratio = float(signal.isna().mean().mean())
    xs_size = int(signal.notna().sum(axis=1).mean())
    return {
        "cross_section_size_mean": xs_size,
        "mean": float(signal.mean().mean()),
        "std": float(signal.stack().std()),
        "nan_ratio": nan_ratio,
    }


# ---------------------------------------------------------------------------
# 内置因子
# ---------------------------------------------------------------------------

BUILTIN_FACTORS = {
    "momentum_20": ("close / delay(close, 20) - 1", "动量（20日）"),
    "reversal_5": ("-1 * (close / delay(close, 5) - 1)", "反转（5日）"),
    "lowvol_20": ("-1 * ts_std(close / delay(close, 1) - 1, 20)", "低波动（20日）"),
    "alpha101_101": ("(close - open) / ((high - low) + 0.001)", "Alpha101 #101"),
    "alpha101_12": ("sign(delta(volume, 1)) * (-1 * delta(close, 1))", "Alpha101 #12"),
    "corr_open_vol": ("-1 * correlation(rank(open), rank(volume), 10)", "量价背离"),
}


# ---------------------------------------------------------------------------
# 自定义表达式 DSL（受限算子集）
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(
    r"\s*(?:(\d+(?:\.\d+)?)|([a-zA-Z_][a-zA-Z0-9_]*)|([+\-*/(),]))"
)


def _tokenize(expr: str):
    tokens = []
    pos = 0
    while pos < len(expr):
        m = _TOKEN_RE.match(expr, pos)
        if not m or m.end() == pos:
            raise ValueError(f"表达式无法解析（位置 {pos} 附近）：{expr}")
        num, ident, op = m.groups()
        if num is not None:
            tokens.append(("num", float(num)))
        elif ident is not None:
            tokens.append(("ident", ident))
        else:
            tokens.append(("op", op))
        pos = m.end()
    tokens.append(("eof", None))
    return tokens


class _ExprParser:
    """受限因子表达式解析器。

    支持字段：open / high / low / close / volume
    支持算子：delay(x,n) ts_std(x,n) ts_mean(x,n) ts_rank(x,n) ts_min(x,n)
             ts_max(x,n) correlation(x,y,n) rank(x) delta(x,n)
             sign(x) abs(x) log(x)
    支持运算：+ - * / 一元负号、括号、整数/浮点字面量。
    """

    FIELDS = {"open", "high", "low", "close", "volume"}
    FUNCS = {
        "delay", "ts_std", "ts_mean", "ts_rank", "ts_min", "ts_max",
        "correlation", "rank", "delta", "sign", "abs", "log",
    }

    def __init__(self, expr: str, env: dict):
        self.tokens = _tokenize(expr)
        self.pos = 0
        self.env = env  # {"open": DF, "high": DF, ...}

    def peek(self):
        return self.tokens[self.pos]

    def next(self):
        t = self.tokens[self.pos]
        self.pos += 1
        return t

    def expect_op(self, op):
        t = self.next()
        if t != ("op", op):
            raise ValueError(f"期望运算符 {op!r}，实际 {t!r}")

    def parse(self):
        node = self.parse_expr()
        if self.peek() != ("eof", None):
            raise ValueError(f"表达式末尾有多余内容：{self.peek()!r}")
        return node

    def parse_expr(self):
        node = self.parse_term()
        while self.peek() == ("op", "+") or self.peek() == ("op", "-"):
            op = self.next()[1]
            rhs = self.parse_term()
            node = ("bin", op, node, rhs)
        return node

    def parse_term(self):
        node = self.parse_unary()
        while self.peek() == ("op", "*") or self.peek() == ("op", "/"):
            op = self.next()[1]
            rhs = self.parse_unary()
            node = ("bin", op, node, rhs)
        return node

    def parse_unary(self):
        if self.peek() == ("op", "-"):
            self.next()
            return ("neg", self.parse_unary())
        if self.peek() == ("op", "+"):
            self.next()
            return self.parse_unary()
        return self.parse_primary()

    def parse_primary(self):
        t = self.next()
        if t[0] == "num":
            return ("const", t[1])
        if t[0] == "ident":
            name = t[1]
            if self.peek() == ("op", "("):
                if name not in self.FUNCS:
                    raise ValueError(f"未知算子：{name}（支持 {sorted(self.FUNCS)}）")
                self.next()  # (
                args = []
                if self.peek() != ("op", ")"):
                    args.append(self.parse_expr())
                    while self.peek() == ("op", ","):
                        self.next()
                        args.append(self.parse_expr())
                self.expect_op(")")
                return ("call", name, args)
            if name in self.FIELDS:
                return ("field", name)
            raise ValueError(f"未知字段：{name}（支持 {sorted(self.FIELDS)}）")
        raise ValueError(f"意外 token：{t!r}")


def _eval_node(node, env: dict) -> pd.DataFrame:
    kind = node[0]
    if kind == "const":
        return pd.DataFrame(float(node[1]), index=env["_index"], columns=env["_columns"])
    if kind == "field":
        return env[node[1]]
    if kind == "neg":
        return -_eval_node(node[1], env)
    if kind == "bin":
        op, l, r = node[1], _eval_node(node[2], env), _eval_node(node[3], env)
        if op == "+":
            return l + r
        if op == "-":
            return l - r
        if op == "*":
            return l * r
        if op == "/":
            return l / r.replace(0, np.nan)
        raise ValueError(f"未知二元运算符：{op}")
    if kind == "call":
        fname, args = node[1], node[2]
        if fname in ("delay", "ts_std", "ts_mean", "ts_rank", "ts_min", "ts_max", "delta"):
            x = _eval_node(args[0], env)
            n = int(_eval_node(args[1], env).iloc[0, 0])
            if fname == "delay":
                return x.shift(n)
            if fname == "ts_std":
                return x.rolling(n, min_periods=2).std()
            if fname == "ts_mean":
                return x.rolling(n, min_periods=1).mean()
            if fname == "ts_rank":
                return x.rolling(n, min_periods=1).rank(pct=True)
            if fname == "ts_min":
                return x.rolling(n, min_periods=1).min()
            if fname == "ts_max":
                return x.rolling(n, min_periods=1).max()
            if fname == "delta":
                return x - x.shift(n)
        if fname == "correlation":
            x = _eval_node(args[0], env)
            y = _eval_node(args[1], env)
            n = int(_eval_node(args[2], env).iloc[0, 0])
            return x.rolling(n, min_periods=3).corr(y)
        if fname == "rank":
            return _eval_node(args[0], env).rank(axis=1, pct=True)
        if fname == "sign":
            return np.sign(_eval_node(args[0], env))
        if fname == "abs":
            return _eval_node(args[0], env).abs()
        if fname == "log":
            x = _eval_node(args[0], env)
            return x.replace(0, np.nan).apply(np.log)
    raise ValueError(f"无法求值节点：{node}")


def compute_signal_from_expr(expr: str, env: dict) -> pd.DataFrame:
    parser = _ExprParser(expr, env)
    return _eval_node(parser.parse(), env)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def load_panel(path: str) -> pd.DataFrame:
    panel = pd.read_parquet(path)
    panel["date"] = pd.to_datetime(panel["date"])
    return panel


def build_env(panel: pd.DataFrame) -> dict:
    env = {
        "open": _pivot(panel, "open"),
        "high": _pivot(panel, "high"),
        "low": _pivot(panel, "low"),
        "close": _pivot(panel, "close"),
        "volume": _pivot(panel, "volume"),
    }
    env["_index"] = env["close"].index
    env["_columns"] = env["close"].columns
    return env


def compute_signal(panel: pd.DataFrame, factor: str, expr: str = "") -> pd.DataFrame:
    """内置因子或自定义表达式 → 截面因子值 [date × symbol]。"""
    env = build_env(panel)
    if expr and expr.strip():
        return compute_signal_from_expr(expr, env)
    if factor in BUILTIN_FACTORS:
        return compute_signal_from_expr(BUILTIN_FACTORS[factor][0], env)
    raise ValueError(f"未知因子：{factor}（内置：{sorted(BUILTIN_FACTORS)}，或提供 expr）")


def _f(v):
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return None
    return float(v)


def main_evaluate(args) -> dict:
    panel = load_panel(args.panel)
    signal = compute_signal(panel, args.factor, args.expr)
    open_p = _pivot(panel, "open")
    fwd = forward_return(open_p, args.horizon, args.label_kind)
    signal = signal.reindex_like(fwd)

    # 1. 契约校验
    contract = validate_signal(signal)

    # 2. 双 IC
    ic = both_ic(signal, fwd)

    # 3. 多头回测
    bt = long_topk_backtest(signal, open_p, panel, top_frac=0.10, cost_bps=args.cost_bps)

    # 4. 单调性
    mono, group_rets = monotonicity(signal, fwd, args.n_groups)

    # 5. 换手率（含在 bt 中）

    # 6. 主分
    score, comps = primary_score(
        ic["rank_ic_ir"], bt["sharpe"], bt["annual_return"],
        bt["max_drawdown"], mono, bt["annual_turnover"],
    )

    rank_ic = ic["rank_ic_series"]
    rolling_ic = rank_ic.rolling(20, min_periods=5).mean()

    result = {
        "meta": {
            "factor": args.factor,
            "expr": args.expr or BUILTIN_FACTORS.get(args.factor, ("", ""))[0],
            "factor_cn": BUILTIN_FACTORS.get(args.factor, ("", "自定义表达式"))[1],
            "pool_label": args.pool_label,
            "horizon": args.horizon,
            "label_kind": args.label_kind,
            "period": args.period or f"{panel['date'].min():%Y%m%d}-{panel['date'].max():%Y%m%d}",
            "n_groups": args.n_groups,
            "cost_bps": args.cost_bps,
            "n_stocks": int(open_p.shape[1]),
            "n_days": int(open_p.shape[0]),
        },
        "primary_score": _f(score),
        "components": {k: _f(v) for k, v in comps.items()},
        "contract": {k: _f(v) for k, v in contract.items()},
        "metrics": {
            "rank_ic_mean": _f(ic["rank_ic_mean"]),
            "rank_ic_ir": _f(ic["rank_ic_ir"]),
            "pearson_ic_mean": _f(ic["pearson_ic_mean"]),
            "pearson_ic_ir": _f(ic["pearson_ic_ir"]),
            "ic_pos_ratio": _f(float((rank_ic > 0).mean())),
            "sharpe": _f(bt["sharpe"]),
            "annual_return": _f(bt["annual_return"]),
            "annual_vol": _f(bt["annual_vol"]),
            "max_drawdown": _f(bt["max_drawdown"]),
            "monotonicity": _f(mono),
            "annual_turnover": _f(bt["annual_turnover"]),
            "top10_avg_daily_ret": _f(bt["top10_avg_daily_ret"]),
        },
        "series": {
            "dates": [d.strftime("%Y-%m-%d") for d in rank_ic.index],
            "rank_ic": [_f(v) for v in rank_ic.values],
            "pearson_ic": [_f(v) for v in ic["pearson_ic_series"].reindex(rank_ic.index).values],
            "rolling_ic": [_f(v) for v in rolling_ic.values],
            "nav": [_f(v) for v in bt["nav"].values],
            "bench_nav": [_f(v) for v in bt["bench_nav"].values],
            "turnover": [_f(v) for v in bt["turnover_series"].values],
        },
        "quantile_returns": [_f(v) for v in group_rets],
        "disclaimer": "本报告基于公开数据与历史回测生成，仅供研究参考，不构成任何投资建议。",
    }
    return result


def write_summary_md(result: dict, path: str) -> None:
    m = result["meta"]
    c = result["components"]
    mt = result["metrics"]
    lines = [
        "=== Factor Evaluate Report ===",
        f"Factor    : {m['factor']} ({m['factor_cn']})",
        f"Expr      : {m['expr']}",
        f"Pool      : {m['pool_label']} ({m['n_stocks']} 只)  [{m['period']}]",
        f"Horizon   : {m['horizon']}d   Label: {m['label_kind']}",
        "",
        f"主分                : {result['primary_score']:+.4f}    (v2 公式)",
        f"├─ IC term  (0.20) : {c['ic_term']:+.2f}       rank_ic_ir={mt['rank_ic_ir']:.2f}",
        f"├─ Shp term (0.30) : {c['shp_term']:+.2f}       sharpe={mt['sharpe']:.2f}",
        f"├─ Ret term (0.30) : {c['ret_term']:+.2f}       annual_ret={mt['annual_return']*100:.1f}%",
        f"├─ MDD term (0.20) : {c['mdd_term']:+.2f}       max_dd={mt['max_drawdown']*100:.1f}%",
        f"├─ Mono     (0.10) : {c['mono_term']:+.2f}       monotonicity={mt['monotonicity']:.2f}",
        f"└─ Turn pen (0.10) : {c['turn_term']:+.2f}       ann_turnover={mt['annual_turnover']:.1f}",
        "",
        "诊断指标（不入主分）:",
        f"  rank IC mean      : {mt['rank_ic_mean']:+.4f}",
        f"  pearson IC mean   : {mt['pearson_ic_mean']:+.4f}",
        f"  IC > 0 占比       : {mt['ic_pos_ratio']*100:.1f}%",
        f"  Top10% 平均收益   : {mt['top10_avg_daily_ret']*100:.3f}% / day",
        "",
        "分组年化收益（5 分位）: " + " / ".join(f"Q{i+1}={v*100:.2f}%" for i, v in enumerate(result["quantile_returns"])),
        "",
        result["disclaimer"],
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description="单因子截面有效性评估（skill-factor-evaluate 6 步流程）")
    ap.add_argument("--panel", required=True, help="行情面板 parquet 路径（长表：date/symbol/open/high/low/close/volume/...）")
    ap.add_argument("--factor", default="momentum_20", help="内置因子名")
    ap.add_argument("--expr", default="", help="自定义因子表达式（非空时覆盖内置因子）")
    ap.add_argument("--horizon", type=int, default=5, choices=[1, 5, 10])
    ap.add_argument("--label-kind", default="market_neutral", choices=["market_neutral", "rank"])
    ap.add_argument("--n-groups", type=int, default=5, choices=[5, 10])
    ap.add_argument("--cost-bps", type=float, default=15.0)
    ap.add_argument("--pool-label", default="pool")
    ap.add_argument("--period", default="")
    ap.add_argument("--out-dir", default="output")
    ap.add_argument("--out-signal", default="", help="仅计算信号模式：输出信号 parquet 路径")
    ap.add_argument("--compute-signal", action="store_true", help="只计算因子信号，不做评估")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    if args.compute_signal:
        panel = load_panel(args.panel)
        signal = compute_signal(panel, args.factor, args.expr)
        out = args.out_signal or os.path.join(args.out_dir, f"factor_signal_{args.factor}.parquet")
        signal.reset_index().rename(columns={"index": "date"}).to_parquet(out, index=False)
        print(f"信号已写出：{out}  shape={signal.shape}")
        return

    result = main_evaluate(args)
    result_path = os.path.join(args.out_dir, "evaluation_result.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    write_summary_md(result, os.path.join(args.out_dir, "evaluation_summary.md"))

    signal = compute_signal(load_panel(args.panel), args.factor, args.expr)
    signal.reset_index().rename(columns={"index": "date"}).to_parquet(
        os.path.join(args.out_dir, f"factor_signal_{args.factor}.parquet"), index=False
    )
    print(f"评估完成：primary_score={result['primary_score']:+.4f}")
    print(f"  JSON : {result_path}")
    print(f"  MD   : {os.path.join(args.out_dir, 'evaluation_summary.md')}")


if __name__ == "__main__":
    main()
