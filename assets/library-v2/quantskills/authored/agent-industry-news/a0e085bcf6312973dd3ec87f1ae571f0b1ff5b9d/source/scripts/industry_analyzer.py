#!/usr/bin/env python3
"""
行业新闻分析助手 — 行业新闻解析与结构化工具
=============================================

将用户粘贴的新闻文本或上传文件解析为结构化记录，
供 AI Agent 进行后续情绪分析、实体识别和产业链影响判断。

用法:
  python scripts/industry_analyzer.py --input news.txt --output /tmp/parsed_news.json
  python scripts/industry_analyzer.py --input news.txt --format csv --output /tmp/parsed_news.csv

支持的输入格式: TXT, MD, CSV (带 "title" 或 "content" 列)
"""

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime


# ──────────── 行业关键词识别 ────────────

INDUSTRY_KEYWORDS = {
    "地产": [
        "房地产", "地产", "楼市", "商品房", "住宅", "土地出让",
        "房企", "开发商", "房贷", "按揭", "首付", "公积金",
        "限购", "限售", "限价", "去库存", "棚改", "旧改",
        "保障房", "租赁住房", "REITs", "物业", "商业地产",
        "万科", "保利", "招商蛇口", "华润置地", "龙湖",
        "碧桂园", "恒大", "融创", "绿城", "中海地产",
        "金地", "绿地", "新城控股", "滨江集团", "越秀",
        "央行", "银保监会", "LPR", "首套房贷利率", "认房不认贷",
    ],
    "医药": [
        "医药", "医疗", "制药", "生物药", "创新药", "仿制药",
        "中药", "CXO", "CDMO", "原料药", "疫苗", "抗体",
        "医疗器械", "IVD", "体外诊断", "高值耗材", "影像",
        "集采", "医保", "国家医保局", "国家药监局", "NMPA",
        "FDA", "临床试验", "NDA", "BLA", "IND",
        "恒瑞医药", "迈瑞医疗", "药明康德", "百济神州",
        "智飞生物", "长春高新", "片仔癀", "云南白药",
        "复星医药", "华东医药", "凯莱英", "康龙化成",
        "泰格医药", "通策医疗", "爱尔眼科", "联影医疗",
    ],
    "新能源": [
        "新能源", "光伏", "风电", "锂电", "电池", "储能",
        "氢能", "燃料电池", "新能源汽车", "电动车", "充电桩",
        "太阳能", "逆变器", "硅料", "硅片", "电池片", "组件",
        "正极", "负极", "隔膜", "电解液", "碳酸锂", "磷酸铁锂",
        "三元", "钠离子", "固态电池", "钙钛矿",
        "宁德时代", "比亚迪", "隆基绿能", "阳光电源",
        "通威股份", "晶科能源", "天合光能", "晶澳科技",
        "亿纬锂能", "国轩高科", "恩捷股份", "天赐材料",
        "华友钴业", "赣锋锂业", "天齐锂业", "中环股份",
        "国家能源局", "双碳", "碳中和", "能耗双控",
    ],
}


def detect_industries(text: str) -> list:
    """根据关键词识别新闻涉及的行业（可多行业）。"""
    matched = []
    text_lower = text.lower()
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                matched.append(industry)
                break
    return matched if matched else ["未知"]


# ──────────── 新闻条目分割 ────────────

NEWS_SEPARATORS = re.compile(
    r"(?:^|\n)\s*(?:\d+[.、．\)\)]\s*|\*{1,3}\s*|[-—]{3,}\s*)",
    re.MULTILINE
)


def split_news(text: str) -> list:
    """将原始文本分割为独立新闻条目。"""
    # 先按分隔符切割
    parts = NEWS_SEPARATORS.split(text.strip())
    parts = [p.strip() for p in parts if p.strip()]
    # 如果切割结果只有一条，尝试按空行分割
    if len(parts) <= 1:
        parts = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    return parts


# ──────────── 文件读取 ────────────

def read_input(path: str) -> str:
    """读取输入文件（TXT / MD / CSV）。"""
    ext = os.path.splitext(path)[1].lower()

    if ext in (".csv",):
        # CSV 读取 content 或 title 列
        rows = []
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                content = row.get("content") or row.get("标题") or row.get("Content") or ""
                rows.append(content)
        return "\n\n".join(rows)

    # TXT / MD / 无后缀文本文件
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ──────────── 结构化输出 ────────────

def build_records(news_items: list, source: str = "manual") -> list:
    """将原始新闻条目转为结构化记录。"""
    records = []
    for i, item in enumerate(news_items):
        industries = detect_industries(item)
        records.append({
            "id": i + 1,
            "raw_text": item,
            "source": source,
            "detected_industries": industries,
            "char_count": len(item),
            "created_at": datetime.now().isoformat(),
            # 以下字段由 AI Agent 后续填充
            "summary": "",
            "sentiment": "",
            "sentiment_score": None,
            "sentiment_confidence": "",
            "affected_stocks": [],
            "affected_sectors": [],
            "policy": "",
            "keywords": [],
            "supply_chain_position": "",
            "impact_level": "",
            "macro_verification": "",
        })
    return records


def save_json(records: list, path: str):
    """保存为 JSON。"""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"已保存 {len(records)} 条记录到 {path}")


def save_csv(records: list, path: str):
    """保存为 CSV（UTF-8 BOM）。"""
    if not records:
        print("无数据，跳过 CSV 输出")
        return
    fieldnames = list(records[0].keys())
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in records:
            writer.writerow(row)
    print(f"已保存 {len(records)} 条记录到 {path}")


# ──────────── 主入口 ────────────

def main():
    parser = argparse.ArgumentParser(
        description="行业新闻解析与结构化工具"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入文件路径（TXT / MD / CSV）"
    )
    parser.add_argument(
        "--output", "-o",
        default="/tmp/parsed_news.json",
        help="输出文件路径（默认: /tmp/parsed_news.json）"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["json", "csv"],
        default="json",
        help="输出格式（默认: json）"
    )
    parser.add_argument(
        "--source", "-s",
        default="manual",
        help="新闻来源标签（默认: manual）"
    )
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"错误: 输入文件不存在: {args.input}", file=sys.stderr)
        sys.exit(1)

    # 读取
    text = read_input(args.input)
    print(f"读取了 {len(text)} 字符")

    # 分割
    items = split_news(text)
    print(f"识别到 {len(items)} 条新闻条目")

    # 结构化
    records = build_records(items, source=args.source)

    # 输出
    if args.format == "csv":
        save_csv(records, args.output)
    else:
        save_json(records, args.output)

    # 行业分布概要
    from collections import Counter
    ind_counter = Counter()
    for rec in records:
        for ind in rec["detected_industries"]:
            ind_counter[ind] += 1
    print("\n行业分布概要:")
    for ind, count in ind_counter.most_common():
        print(f"  {ind}: {count} 条")


if __name__ == "__main__":
    main()