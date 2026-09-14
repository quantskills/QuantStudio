#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_html_report.py — 从 evaluation_result.json 渲染自包含交互式 HTML 评估报告。

输出完全内联 Plotly JS + CSS，无外部网络依赖，可在本 GUI 预览。

用法：
  python generate_html_report.py \
      --input output/evaluation_result.json \
      --output output/factor_evaluation_momentum_20_000300_5d.html
"""

from __future__ import annotations

import argparse
import json
import os
import textwrap

import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def build_html(result: dict) -> str:
    m = result["meta"]
    c = result["components"]
    mt = result["metrics"]
    ser = result["series"]
    qret = result["quantile_returns"]
    score = result["primary_score"]

    # ---- 主分颜色 ----
    if score is None:
        score_str = "N/A"
        score_color = "#888"
    elif score < 0:
        score_str = f"{score:+.4f}"
        score_color = "#d32f2f"
    elif score < 0.5:
        score_str = f"{score:+.4f}"
        score_color = "#f57c00"
    elif score < 1.0:
        score_str = f"{score:+.4f}"
        score_color = "#388e3c"
    elif score < 1.5:
        score_str = f"{score:+.4f}"
        score_color = "#2e7d32"
    else:
        score_str = f"{score:+.4f}"
        score_color = "#1b5e20"

    # ---- 元信息卡 ----
    meta_html = f"""\
    <div class="meta-card">
      <div class="meta-grid">
        <div class="mi"><span class="mi-label">因子</span><span class="mi-val">{m['factor']} ({m['factor_cn']})</span></div>
        <div class="mi"><span class="mi-label">股票池</span><span class="mi-val">{m['pool_label']} ({m['n_stocks']} 只)</span></div>
        <div class="mi"><span class="mi-label">预测周期</span><span class="mi-val">{m['horizon']} 日</span></div>
        <div class="mi"><span class="mi-label">标签口径</span><span class="mi-val">{m['label_kind']}</span></div>
        <div class="mi"><span class="mi-label">样本区间</span><span class="mi-val">{m['period']} ({m['n_days']} 日)</span></div>
        <div class="mi"><span class="mi-label">成本假设</span><span class="mi-val">双边 {m['cost_bps']}bp</span></div>
      </div>
    </div>"""

    # ---- 主分展示 + 六联拆解 ----
    comp_rows = ""
    for label, key, w in [
        ("截面有效性 (IC)", "ic_term", "0.20"),
        ("风险调整收益 (Sharpe)", "shp_term", "0.30"),
        ("年化收益 (Ret)", "ret_term", "0.30"),
        ("最大回撤 (MDD)", "mdd_term", "0.20"),
        ("单调性 (Mono)", "mono_term", "0.10"),
        ("换手惩罚 (Turn)", "turn_term", "0.10"),
    ]:
        v = c.get(key, 0)
        comp_rows += f"""\
        <tr><td>{label}</td><td>× {w}</td><td style="color:{'#d32f2f' if v < 0 else '#388e3c'}">{v:+.2f}</td></tr>"""

    score_html = f"""\
    <div class="score-card">
      <div class="score-main">
        <div class="score-number" style="color:{score_color}">{score_str}</div>
        <div class="score-label">归一主分（v2，范围 ~[-2,+2]）</div>
      </div>
      <div class="score-breakdown">
        <table class="comp-table">
          <tr><th>分量</th><th>权重</th><th>归一值</th></tr>
          {comp_rows}
        </table>
      </div>
    </div>"""

    # ---- 诊断指标表 ----
    metric_rows = ""
    for label, key, fmt in [
        ("Rank IC 均值", mt["rank_ic_mean"], "+.4f"),
        ("Pearson IC 均值", mt["pearson_ic_mean"], "+.4f"),
        ("Rank IC IR", mt["rank_ic_ir"], ".2f"),
        ("Pearson IC IR", mt["pearson_ic_ir"], ".2f"),
        ("IC > 0 占比", mt["ic_pos_ratio"], ".1%"),
        ("多空 Sharpe", mt["sharpe"], ".2f"),
        ("年化收益", mt["annual_return"], ".2%"),
        ("最大回撤", mt["max_drawdown"], ".2%"),
        ("分组单调性", mt["monotonicity"], ".2f"),
        ("年化换手率", mt["annual_turnover"], ".1f"),
        ("Top10% 日均收益", mt["top10_avg_daily_ret"], ".4f"),
    ]:
        if fmt.endswith("%"):
            val_str = f"{float(key * 100 if isinstance(key, str) and '%' in fmt else key):{fmt}}" if key is not None else "N/A"
            # handle percentage formatting manually
            pct_val = f"{key * 100:.1f}%" if key is not None else "N/A"
            val_str = pct_val if "%" in fmt else f"{key:{fmt}}" if key is not None else "N/A"
        else:
            val_str = f"{key:{fmt}}" if key is not None else "N/A"
        if isinstance(key, float) and not np.isfinite(key):
            val_str = "N/A"
        metric_rows += f"<tr><td>{label}</td><td>{val_str}</td></tr>"

    diag_html = f"""\
    <div class="diag-card">
      <h3>诊断指标</h3>
      <table class="diag-table">{metric_rows}</table>
    </div>"""

    # ---- 图表 1: 双 IC 时序 ----
    fig1 = go.Figure()
    fig1.add_trace(go.Scatter(
        x=ser["dates"], y=ser["rank_ic"],
        name="Rank IC", mode="lines", line=dict(width=1.5, color="#1f77b4"),
    ))
    fig1.add_trace(go.Scatter(
        x=ser["dates"], y=ser["pearson_ic"],
        name="Pearson IC", mode="lines", line=dict(width=1.5, color="#ff7f0e", dash="dot"),
    ))
    fig1.add_hline(y=0, line_color="#888", line_width=0.8)
    fig1.update_layout(
        title="双 IC 时序对比", height=320, margin=dict(l=40, r=20, t=40, b=40),
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.7)"),
        yaxis_title="IC",
    )

    # ---- 图表 2: 滚动 IC ----
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=ser["dates"], y=ser["rolling_ic"],
        name="Rank IC (20d MA)", mode="lines",
        line=dict(width=2, color="#2ca02c"), fill="tozeroy", fillcolor="rgba(44,160,44,0.15)",
    ))
    fig2.add_hline(y=0, line_color="#888", line_width=0.8)
    fig2.update_layout(
        title="滚动 Rank IC（20 日窗口）", height=300, margin=dict(l=40, r=20, t=40, b=40),
        yaxis_title="Rolling IC",
    )

    # ---- 图表 3: 净值曲线 ----
    fig3 = go.Figure()
    fig3.add_trace(go.Scatter(
        x=ser["dates"], y=ser["nav"],
        name="Top10% 多头净值", mode="lines",
        line=dict(width=2, color="#d62728"),
    ))
    fig3.add_trace(go.Scatter(
        x=ser["dates"], y=ser["bench_nav"],
        name="等权基准净值", mode="lines",
        line=dict(width=1.5, color="#7f7f7f", dash="dash"),
    ))
    # MDD 标注
    nav_arr = np.array(ser["nav"])
    cummax = np.maximum.accumulate(nav_arr)
    dd = nav_arr / cummax - 1
    dd_min_idx = int(np.argmin(dd))
    if dd_min_idx < len(ser["dates"]):
        fig3.add_annotation(
            x=ser["dates"][dd_min_idx], y=ser["nav"][dd_min_idx],
            text=f"MDD={mt['max_drawdown']*100:.1f}%" if mt.get("max_drawdown") else "MDD=N/A",
            showarrow=True, arrowhead=2, ax=40, ay=-60,
            bgcolor="rgba(255,255,255,0.8)", bordercolor="#d62728", borderwidth=1,
        )
    fig3.update_layout(
        title="多头回测净值", height=350, margin=dict(l=40, r=20, t=40, b=40),
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.7)"),
        yaxis_title="净值",
    )

    # ---- 图表 4: 分组收益 ----
    fig4 = go.Figure()
    grp_labels = [f"Q{i+1}" for i in range(len(qret))]
    colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
              "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
    fig4.add_trace(go.Bar(
        x=grp_labels, y=[v * 100 for v in qret],
        marker_color=colors[: len(qret)],
        text=[f"{v*100:.2f}%" for v in qret],
        textposition="outside",
    ))
    fig4.update_layout(
        title=f"分组年化收益（{m['n_groups']} 分位，单调性={mt.get('monotonicity', 'N/A')}）",
        height=320, margin=dict(l=40, r=20, t=40, b=40),
        yaxis_title="年化收益 (%)",
    )

    # ---- 图表 5: 换手率时序 ----
    fig5 = go.Figure()
    fig5.add_trace(go.Scatter(
        x=ser["dates"], y=ser["turnover"],
        name="单边换手率", mode="lines",
        line=dict(width=1.5, color="#9467bd"), fill="tozeroy", fillcolor="rgba(148,103,189,0.12)",
    ))
    fig5.update_layout(
        title=f"换手率时序（年化 {mt.get('annual_turnover', 'N/A')}）",
        height=250, margin=dict(l=40, r=20, t=40, b=40),
        yaxis_title="单边换手率",
    )

    # ---- 组合图表（两列布局） ----
    # 双 IC + 滚动 IC 每行一个，净值 + 分组并排，换手单独一行
    html_charts = []
    for fig in [fig1, fig2, fig3, fig4, fig5]:
        html_charts.append(fig.to_html(
            full_html=False, include_plotlyjs=False,
            config={"responsive": True, "displayModeBar": False},
        ))
    # 使用 Plotly 的 include_plotlyjs 一次
    with_plotly_js = fig1.to_html(
        include_plotlyjs=True, full_html=False,
        config={"responsive": True, "displayModeBar": False},
    )
    # 提取 script 部分并去掉重复的 <div>
    import re as _re
    _div_only = _re.sub(r"<script.*?</script>", "", with_plotly_js, count=1, flags=_re.DOTALL)
    plotly_script = _re.search(r"(<script.*?>.*?</script>)", with_plotly_js, _re.DOTALL)
    plotly_js = plotly_script.group(1) if plotly_script else ""

    chart_divs = "\n".join(html_charts)

    # ---- 假设说明 + 免责 ----
    assumptions = textwrap.dedent("""\
    <div class="assumptions">
      <h3>评估口径与假设</h3>
      <ul>
        <li>数据来源：PandaData A 股日线行情（OHLCV + 涨跌停 + 停牌状态）。</li>
        <li>成交假设：T+1 开盘买入 / 卖出（信号 T 日生成，T+1 开盘执行）。</li>
        <li>组合权重：多头 Top 10% 等权配置。持仓组合每日根据新信号再平衡。</li>
        <li>交易成本：双边 {m['cost_bps']}bp，按单边换手率扣除。</li>
        <li>样本剔除：涨停、跌停、停牌股票在对应交易日的截面中剔除。</li>
        <li>Forward Return：open[T+1+H] / open[T+1] - 1，{m['label_kind']} 口径。</li>
        <li>不模拟市场冲击、集合竞价滑点、融券约束；不处理分红除权除息 / 配股 / 重大事件停牌。</li>
      </ul>
    </div>""")

    disclaimer = f"""\
    <div class="disclaimer">
      <p>{result['disclaimer']}</p>
    </div>"""

    # ---- 完整 HTML 组装 ----
    html = f"""\
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>因子评估报告：{m['factor']} @ {m['pool_label']} ({m['horizon']}d)</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f6fa; color: #333; line-height: 1.6; padding: 20px; }}
  .container {{ max-width: 1100px; margin: 0 auto; }}
  h1 {{ font-size: 22px; margin-bottom: 16px; color: #111; }}
  h3 {{ font-size: 16px; margin-bottom: 8px; color: #333; }}

  .meta-card {{ background: #fff; border-radius: 10px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; }}
  .meta-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px 20px; }}
  .mi {{ display: flex; flex-direction: column; }}
  .mi-label {{ font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }}
  .mi-val {{ font-size: 15px; font-weight: 600; color: #222; }}

  .score-card {{ background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }}
  .score-main {{ text-align: center; min-width: 140px; }}
  .score-number {{ font-size: 48px; font-weight: 700; line-height: 1.1; }}
  .score-label {{ font-size: 12px; color: #888; margin-top: 2px; }}
  .comp-table {{ border-collapse: collapse; font-size: 13px; }}
  .comp-table th {{ text-align: left; padding: 2px 12px 2px 0; border-bottom: 1px solid #eee; color: #888; font-weight: 400; font-size: 11px; }}
  .comp-table td {{ padding: 3px 12px 3px 0; }}

  .diag-card {{ background: #fff; border-radius: 10px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; }}
  .diag-table {{ border-collapse: collapse; font-size: 13px; width: 100%; }}
  .diag-table td, .diag-table th {{ padding: 4px 12px; text-align: left; }}
  .diag-table th {{ color: #888; font-weight: 400; font-size: 11px; border-bottom: 1px solid #eee; }}
  .diag-table tr:nth-child(even) td {{ background: #fafafa; }}

  .chart-card {{ background: #fff; border-radius: 10px; padding: 12px 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; overflow: hidden; }}

  .assumptions {{ background: #fff; border-radius: 10px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; font-size: 13px; color: #555; }}
  .assumptions ul {{ padding-left: 18px; }}
  .assumptions li {{ margin-bottom: 4px; }}

  .disclaimer {{ background: #fff4e5; border-radius: 10px; padding: 12px 20px; margin-bottom: 16px; font-size: 12px; color: #8a6d3b; border: 1px solid #fae3c3; }}

  .row {{ display: flex; flex-wrap: wrap; gap: 16px; }}
  .row > * {{ flex: 1 1 48%; min-width: 320px; }}

  @media (max-width: 700px) {{ .row > * {{ min-width: 100%; }} }}

  /* 图表内联时默认宽度 */
  .js-plotly-plot {{ width: 100% !important; }}
</style>
</head>
<body>
<div class="container">

<h1>因子评估报告</h1>
{meta_html}
{score_html}
{diag_html}

<div class="chart-card">{plotly_js}{_div_only}</div>
<div class="chart-card">{html_charts[1]}</div>
<div class="row">
  <div class="chart-card">{html_charts[2]}</div>
  <div class="chart-card">{html_charts[3]}</div>
</div>
<div class="chart-card">{html_charts[4]}</div>

{assumptions}
{disclaimer}

</div>
</body>
</html>"""
    return html


def main() -> None:
    ap = argparse.ArgumentParser(description="从 evaluation_result.json 生成交互式 HTML 评估报告")
    ap.add_argument("--input", required=True, help="evaluation_result.json 路径")
    ap.add_argument("--output", required=True, help="输出 HTML 文件路径")
    args = ap.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        result = json.load(f)

    html = build_html(result)
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"报告已写出：{args.output}")


if __name__ == "__main__":
    main()