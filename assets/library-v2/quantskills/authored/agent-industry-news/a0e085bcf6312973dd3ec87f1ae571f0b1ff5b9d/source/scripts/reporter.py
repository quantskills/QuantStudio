#!/usr/bin/env python3
"""
行业新闻分析助手 — 多格式报告生成器
=====================================

从结构化分析数据生成：
1. HTML 自包含报告（含图表）
2. CSV 结构化数据表
3. Markdown 分析报告

用法:
  python scripts/reporter.py --analysis /tmp/analysis.json --output-dir output
  python scripts/reporter.py --analysis /tmp/analysis.json --output-dir output --macro /tmp/macro_context.json
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime
from html import escape


# ──────────── HTML 报告模板 ────────────

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>行业新闻分析报告</title>
<style>
  :root {{
    --bg: #f8f9fa;
    --card: #ffffff;
    --text: #1a1a2e;
    --text-sec: #6c757d;
    --border: #e9ecef;
    --positive: #28a745;
    --negative: #dc3545;
    --neutral: #6c757d;
    --accent: #4361ee;
    --accent-light: #eef0ff;
  }}
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; padding: 20px; }}
  .container {{ max-width: 1200px; margin: 0 auto; }}
  header {{ background: linear-gradient(135deg, #4361ee, #3a0ca3); color: white; padding: 40px; border-radius: 16px; margin-bottom: 24px; }}
  header h1 {{ font-size: 28px; margin-bottom: 8px; }}
  header .meta {{ opacity: 0.85; font-size: 14px; }}
  .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }}
  .summary-card {{ background: var(--card); border-radius: 12px; padding: 20px; border: 1px solid var(--border); text-align: center; }}
  .summary-card .num {{ font-size: 32px; font-weight: 700; }}
  .summary-card .label {{ font-size: 13px; color: var(--text-sec); margin-top: 4px; }}
  .summary-card.positive .num {{ color: var(--positive); }}
  .summary-card.negative .num {{ color: var(--negative); }}
  .summary-card.neutral .num {{ color: var(--neutral); }}
  .heatmap {{ background: var(--card); border-radius: 12px; padding: 24px; border: 1px solid var(--border); margin-bottom: 24px; overflow-x: auto; }}
  .heatmap h2 {{ font-size: 18px; margin-bottom: 16px; }}
  .heatmap table {{ width: 100%; border-collapse: collapse; }}
  .heatmap th, .heatmap td {{ padding: 10px 16px; text-align: center; border: 1px solid var(--border); }}
  .heatmap th {{ background: var(--accent-light); font-weight: 600; }}
  .heatmap .cell {{ display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 600; min-width: 40px; }}
  .news-card {{ background: var(--card); border-radius: 12px; padding: 24px; border: 1px solid var(--border); margin-bottom: 16px; }}
  .news-card h3 {{ font-size: 16px; margin-bottom: 8px; }}
  .news-card .tag {{ display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; margin-right: 6px; margin-bottom: 6px; }}
  .tag.estate {{ background: #e3f2fd; color: #1565c0; }}
  .tag.pharma {{ background: #fce4ec; color: #c62828; }}
  .tag.energy {{ background: #e8f5e9; color: #2e7d32; }}
  .tag.positive {{ background: #d4edda; color: #155724; }}
  .tag.negative {{ background: #f8d7da; color: #721c24; }}
  .tag.neutral {{ background: #e2e3e5; color: #383d41; }}
  .news-card .detail {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; font-size: 14px; }}
  .news-card .detail .field {{ color: var(--text-sec); }}
  .news-card .stock-list {{ margin-top: 8px; }}
  .news-card .stock-item {{ display: inline-block; padding: 2px 8px; background: #f0f0f0; border-radius: 4px; font-size: 13px; margin-right: 4px; margin-bottom: 4px; }}
  .macro-section {{ background: var(--card); border-radius: 12px; padding: 24px; border: 1px solid var(--border); margin-bottom: 24px; }}
  .macro-section h2 {{ font-size: 18px; margin-bottom: 16px; }}
  .macro-section table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
  .macro-section th, .macro-section td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }}
  .macro-section th {{ background: var(--accent-light); font-weight: 600; }}
  .verify-confirm {{ color: var(--positive); }}
  .verify-conflict {{ color: var(--negative); }}
  .verify-insufficient {{ color: var(--neutral); }}
  .chart-bar {{ display: flex; align-items: center; margin: 4px 0; }}
  .chart-bar .bar {{ height: 20px; border-radius: 4px; min-width: 4px; transition: width 0.3s; }}
  .chart-bar .label {{ width: 80px; font-size: 13px; }}
  .chart-bar .val {{ margin-left: 8px; font-size: 13px; font-weight: 600; }}
  footer {{ text-align: center; padding: 32px; color: var(--text-sec); font-size: 13px; }}
  .disclaimer {{ background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin-top: 24px; font-size: 13px; }}
  @media (max-width: 768px) {{
    .news-card .detail {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>
<div class="container">

<header>
  <h1>📊 行业新闻分析报告</h1>
  <div class="meta">
    生成时间: {generated_at} &nbsp;|&nbsp; 分析新闻: {total_count} 条
    &nbsp;|&nbsp; 专注行业: 地产 · 医药 · 新能源
  </div>
</header>

<!-- 概览卡片 -->
<div class="summary-grid">
  <div class="summary-card">
    <div class="num">{total_count}</div>
    <div class="label">新闻总数</div>
  </div>
  <div class="summary-card">
    <div class="num">{estate_count}</div>
    <div class="label">🏠 地产</div>
  </div>
  <div class="summary-card">
    <div class="num">{pharma_count}</div>
    <div class="label">💊 医药</div>
  </div>
  <div class="summary-card">
    <div class="num">{energy_count}</div>
    <div class="label">☀️ 新能源</div>
  </div>
  <div class="summary-card positive">
    <div class="num">{positive_count}</div>
    <div class="label">😊 正面</div>
  </div>
  <div class="summary-card negative">
    <div class="num">{negative_count}</div>
    <div class="label">😟 负面</div>
  </div>
  <div class="summary-card neutral">
    <div class="num">{neutral_count}</div>
    <div class="label">😐 中性</div>
  </div>
</div>

<!-- 行业 × 情绪热力矩阵 -->
<div class="heatmap">
  <h2>📈 行业 × 情绪热力矩阵</h2>
  <table>
    <thead>
      <tr><th>行业</th><th>正面</th><th>负面</th><th>中性</th><th>合计</th></tr>
    </thead>
    <tbody>
      {heatmap_rows}
    </tbody>
  </table>
</div>

<!-- 宏观数据对照 -->
{macro_section}

<!-- 逐条新闻分析 -->
<h2 style="font-size:20px; margin-bottom:16px;">📰 逐条新闻分析</h2>
{news_cards}

<!-- 免责声明 -->
<div class="disclaimer">
  ⚠️ <strong>免责声明</strong>：本报告基于公开新闻文本与规则化分析生成，仅供研究参考，
  不构成任何投资建议。情绪分析由 AI 生成，可能存在偏差。标的识别基于 AI 知识推断，
  不确定时已标注留空。投资决策请以专业机构意见为准。
</div>

<footer>
  行业新闻分析助手 &mdash; 数据来源：用户输入 + skill-macro-monitor (PandaData)
</footer>
</div>
</body>
</html>
"""


# ──────────── 核心生成函数 ────────────

def _sentiment_class(score):
    if score is None:
        return "neutral"
    if score > 0.2:
        return "positive"
    if score < -0.2:
        return "negative"
    return "neutral"


def _sentiment_label(score):
    cls = _sentiment_class(score)
    return {"positive": "😊 正面", "negative": "😟 负面", "neutral": "😐 中性"}[cls]


def _industry_class(industries):
    cls_map = {"地产": "estate", "医药": "pharma", "新能源": "energy"}
    tags = []
    for ind in industries:
        cls = cls_map.get(ind, "")
        tags.append(f'<span class="tag {cls}">{ind}</span>')
    return " ".join(tags)


def generate_html(records: list, macro_data: dict = None) -> str:
    """生成自包含 HTML 报告。"""
    total = len(records)

    # 行业计数
    estate_count = sum(1 for r in records if "地产" in r.get("detected_industries", []))
    pharma_count = sum(1 for r in records if "医药" in r.get("detected_industries", []))
    energy_count = sum(1 for r in records if "新能源" in r.get("detected_industries", []))

    # 情绪计数
    positive_count = sum(1 for r in records if _sentiment_class(r.get("sentiment_score")) == "positive")
    negative_count = sum(1 for r in records if _sentiment_class(r.get("sentiment_score")) == "negative")
    neutral_count = sum(1 for r in records if _sentiment_class(r.get("sentiment_score")) == "neutral")

    # HTML context for heatmap
    def _hmap(industry, sentiment):
        count = 0
        for r in records:
            if industry not in r.get("detected_industries", []):
                continue
            if _sentiment_class(r.get("sentiment_score")) == sentiment:
                count += 1
        return count

    def _heat_color(count, max_c):
        if max_c == 0 or count == 0:
            return "#f0f0f0"
        intensity = count / max_c
        r = int(240 - 180 * intensity)
        g = int(240 - 180 * intensity)
        b = int(255)
        return f"rgb({r},{g},{b})"

    heat_inds = ["地产", "医药", "新能源"]
    max_heat = max(
        _hmap(ind, s) for ind in heat_inds for s in ["positive", "negative", "neutral"]
    ) or 1

    heatmap_rows = ""
    for ind in heat_inds:
        p = _hmap(ind, "positive")
        n = _hmap(ind, "negative")
        neu = _hmap(ind, "neutral")
        sub = p + n + neu
        heatmap_rows += (
            f"<tr>"
            f"<td style='text-align:left;font-weight:600;'>{ind}</td>"
            f"<td><span class='cell' style='background:{_heat_color(p, max_heat)};color:{'#155724' if p > 0 else '#666'}'>{p}</span></td>"
            f"<td><span class='cell' style='background:{_heat_color(n, max_heat)};color:{'#721c24' if n > 0 else '#666'}'>{n}</span></td>"
            f"<td><span class='cell' style='background:{_heat_color(neu, max_heat)};color:#666'>{neu}</span></td>"
            f"<td><strong>{sub}</strong></td>"
            f"</tr>\n"
        )

    # 逐条新闻卡片
    news_cards = ""
    for r in records:
        stocks_html = ""
        for s in r.get("affected_stocks", []):
            code_str = f" ({s.get('code', '')})" if s.get("code") else ""
            impact_tag = f'<span class="tag {s.get("impact", "neutral")}" style="font-size:11px;">{s.get("impact", "中性")}</span>'
            stocks_html += f'<span class="stock-item">{s.get("name", "")}{code_str} {impact_tag}</span>'

        # 原始文本截断
        raw = r.get("raw_text", "")
        raw_short = raw[:300] + ("..." if len(raw) > 300 else "")

        summary = escape(r.get("summary", ""))
        sentiment_tag = f'<span class="tag {_sentiment_class(r.get("sentiment_score"))}">{_sentiment_label(r.get("sentiment_score"))}</span>'
        score_str = f' ({r.get("sentiment_score", "N/A"):+.2f})' if isinstance(r.get("sentiment_score"), (int, float)) else ""
        impact_level = r.get("impact_level", "")

        news_cards += f"""
<div class="news-card">
  <h3>#{r.get('id', '?')} {sentiment_tag}{score_str}</h3>
  <div>
    {_industry_class(r.get("detected_industries", []))}
    {f'<span class="tag neutral">影响: {impact_level}</span>' if impact_level else ''}
  </div>
  <p style="margin-top:8px;color:var(--text-sec);font-size:14px;">{esc(raw_short)}</p>
  <div class="detail">
    <div><span class="field">事件摘要：</span>{summary}</div>
    <div><span class="field">产业链位置：</span>{escape(r.get("supply_chain_position", ""))}</div>
    <div><span class="field">关键词：</span>{', '.join(r.get("keywords", []))}</div>
    <div><span class="field">宏观验证：</span>{_macro_verify_html(r.get("macro_verification", ""))}</div>
  </div>
  {'<div class="stock-list">' + stocks_html + '</div>' if stocks_html else ''}
</div>
"""

    # 宏观数据对照区
    macro_section = ""
    if macro_data:
        macro_rows = ""
        for ind_key in ["地产", "医药", "新能源"]:
            ind_data = macro_data.get(ind_key, {})
            if ind_data:
                for metric_key, val in ind_data.items():
                    macro_rows += f"<tr><td>{ind_key}</td><td>{metric_key}</td><td>{escape(str(val))}</td></tr>"
        if macro_rows:
            macro_section = f"""
<div class="macro-section">
  <h2>📊 宏观 / 行业数据对照</h2>
  <table>
    <thead><tr><th>行业</th><th>指标</th><th>数据</th></tr></thead>
    <tbody>{macro_rows}</tbody>
  </table>
  <p style="margin-top:12px;font-size:13px;color:var(--text-sec);">数据来源: skill-macro-monitor (PandaData)，标注为计算值的已注明</p>
</div>
"""

    return HTML_TEMPLATE.format(
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_count=total,
        estate_count=estate_count,
        pharma_count=pharma_count,
        energy_count=energy_count,
        positive_count=positive_count,
        negative_count=negative_count,
        neutral_count=neutral_count,
        heatmap_rows=heatmap_rows,
        macro_section=macro_section,
        news_cards=news_cards,
    )


def _macro_verify_html(v: str) -> str:
    cls_map = {
        "确认": "verify-confirm",
        "矛盾": "verify-conflict",
        "数据不足": "verify-insufficient",
    }
    cls = cls_map.get(v, "")
    return f'<span class="{cls}">{escape(v)}</span>' if cls else escape(v)


def esc(s: str) -> str:
    return escape(str(s))


# ──────────── CSV 生成 ────────────

def generate_csv(records: list, path: str):
    fieldnames = [
        "id", "detected_industries", "summary", "sentiment", "sentiment_score",
        "sentiment_confidence", "affected_stocks", "affected_sectors",
        "policy", "keywords", "supply_chain_position", "impact_level",
        "macro_verification", "raw_text",
    ]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            row = {k: r.get(k, "") for k in fieldnames}
            # 序列化列表/字典字段为 JSON 字符串
            for lst_field in ["affected_stocks", "affected_sectors", "keywords", "detected_industries"]:
                val = row.get(lst_field)
                if isinstance(val, (list, dict)):
                    row[lst_field] = json.dumps(val, ensure_ascii=False)
            row["sentiment"] = _sentiment_label(r.get("sentiment_score"))
            writer.writerow(row)
    print(f"CSV 已保存: {path}")


# ──────────── Markdown 生成 ────────────

def generate_markdown(records: list, macro_data: dict = None) -> str:
    lines = []
    lines.append("# 行业新闻分析报告\n")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n")
    lines.append(f"**分析新闻**: {len(records)} 条  \n")
    lines.append(f"**专注行业**: 地产 · 医药 · 新能源  \n")
    lines.append("---\n")

    # 情绪概览
    pos = sum(1 for r in records if _sentiment_class(r.get("sentiment_score")) == "positive")
    neg = sum(1 for r in records if _sentiment_class(r.get("sentiment_score")) == "negative")
    neu = sum(1 for r in records if _sentiment_class(r.get("sentiment_score")) == "neutral")
    lines.append("## 情绪概览\n")
    lines.append(f"| 情绪 | 数量 |\n|------|:----:|\n")
    lines.append(f"| 😊 正面 | {pos} |\n")
    lines.append(f"| 😟 负面 | {neg} |\n")
    lines.append(f"| 😐 中性 | {neu} |\n")
    lines.append("\n---\n")

    # 宏观对照
    if macro_data:
        lines.append("## 宏观 / 行业数据对照\n")
        for ind_key in ["地产", "医药", "新能源"]:
            ind_data = macro_data.get(ind_key, {})
            if ind_data:
                lines.append(f"### {ind_key}\n")
                lines.append(f"| 指标 | 数据 |\n|------|------|\n")
                for k, v in ind_data.items():
                    lines.append(f"| {k} | {v} |\n")
                lines.append("\n")
        lines.append("---\n")

    # 逐条分析
    lines.append("## 逐条新闻分析\n")
    for r in records:
        lines.append(f"### #{r.get('id', '?')} {_sentiment_label(r.get('sentiment_score'))}")
        if r.get("sentiment_score") is not None:
            lines.append(f"\n情绪强度: `{r['sentiment_score']:+.2f}`  \n")
        lines.append(f"\n**行业**: {', '.join(r.get('detected_industries', []))}  \n")
        lines.append(f"**事件摘要**: {r.get('summary', '')}  \n")
        lines.append(f"**产业链位置**: {r.get('supply_chain_position', '')}  \n")
        lines.append(f"**影响程度**: {r.get('impact_level', '')}  \n")
        lines.append(f"**宏观验证**: {r.get('macro_verification', '')}  \n")

        stocks = r.get("affected_stocks", [])
        if stocks:
            lines.append("\n**受影响标的**:\n")
            for s in stocks:
                code = f" ({s.get('code', '')})" if s.get("code") else ""
                lines.append(f"- {s.get('name', '')}{code} — 影响: {s.get('impact', '中性')}  \n")
                if s.get("reason"):
                    lines.append(f"  - 理由: {s['reason']}  \n")

        keywords = r.get("keywords", [])
        if keywords:
            lines.append(f"\n**关键词**: `{'`, `'.join(keywords)}`  \n")

        lines.append("\n---\n")

    # 原文
    lines.append("## 附：新闻原文\n")
    for r in records:
        lines.append(f"### #{r.get('id', '?')} 原文\n")
        lines.append(f"> {r.get('raw_text', '')}\n")
        lines.append("\n---\n")

    # 免责声明
    lines.append("\n*本报告基于公开新闻文本与规则化分析生成，仅供研究参考，不构成任何投资建议。*\n")

    return "".join(lines)


# ──────────── 主入口 ────────────

def main():
    parser = argparse.ArgumentParser(description="行业新闻分析 — 多格式报告生成器")
    parser.add_argument("--analysis", "-a", required=True, help="分析结果 JSON 路径")
    parser.add_argument("--macro", "-m", help="宏观数据 JSON 路径（可选）")
    parser.add_argument("--output-dir", "-o", default="output", help="输出目录（默认: output）")
    args = parser.parse_args()

    # 读取分析数据
    if not os.path.isfile(args.analysis):
        print(f"错误: 分析文件不存在: {args.analysis}", file=sys.stderr)
        sys.exit(1)
    with open(args.analysis, "r", encoding="utf-8") as f:
        records = json.load(f)
    print(f"读取 {len(records)} 条分析记录")

    # 读取宏观数据（可选）
    macro_data = None
    if args.macro:
        if os.path.isfile(args.macro):
            with open(args.macro, "r", encoding="utf-8") as f:
                macro_data = json.load(f)
            print(f"读取宏观数据: {len(macro_data)} 个行业")
        else:
            print(f"警告: 宏观文件不存在: {args.macro}", file=sys.stderr)

    # 确保输出目录
    os.makedirs(args.output_dir, exist_ok=True)

    # 生成 HTML
    html = generate_html(records, macro_data)
    html_path = os.path.join(args.output_dir, "industry_news_report.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML 报告已生成: {html_path}")

    # 生成 CSV
    csv_path = os.path.join(args.output_dir, "industry_news_analysis.csv")
    generate_csv(records, csv_path)

    # 生成 Markdown
    md = generate_markdown(records, macro_data)
    md_path = os.path.join(args.output_dir, "industry_news_analysis.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"Markdown 报告已生成: {md_path}")

    print("\n✅ 所有报告已生成完毕")


if __name__ == "__main__":
    main()