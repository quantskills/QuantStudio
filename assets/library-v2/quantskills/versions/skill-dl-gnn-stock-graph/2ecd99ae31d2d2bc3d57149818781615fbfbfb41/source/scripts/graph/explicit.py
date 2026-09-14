"""Explicit relation graphs for A-share stocks.

Explicit relations are those directly observable from structured data:
  1. Industry co-membership (Shenwan L1/L2/L3)
  2. Concept sector co-membership
  3. Supply chain upstream/downstream (placeholder — no direct data source)
  4. Equity relations (common top-10 holders)
  5. Institutional behavior (broker coverage overlap)

Each function returns an edge list as a list of (src_symbol, dst_symbol, relation_type, weight) tuples.
"""
from __future__ import annotations

import pandas as pd
import numpy as np
from collections import defaultdict


def build_industry_edges(
    industry_df: pd.DataFrame,
    universe: list[str],
) -> list[tuple[str, str, str, float]]:
    """Build edges between stocks in the same Shenwan industry, layered L1/L2/L3.

    L3 (sub-sub-industry) gets highest weight, L2 medium, L1 lowest.
    This captures the intuition that stocks in the same L3 (e.g. 火电) have
    stronger price co-movement than stocks merely in the same L1 (e.g. 公用事业).

    Args:
        industry_df: DataFrame from get_industry_constituents.
                     Has columns: stock_symbol, l1_code, l2_code, l3_code.
        universe: list of symbols to include.

    Returns:
        List of (src, dst, relation_type, weight) tuples.
        relation_type is one of 'industry_l1', 'industry_l2', 'industry_l3'.
    """
    df = industry_df.copy()
    sym_col = next((c for c in df.columns if c in ("stock_symbol", "symbol")), None)
    if sym_col is None:
        return []

    df[sym_col] = df[sym_col].astype(str)
    uni_set = set(universe)
    df = df[df[sym_col].isin(uni_set)]

    # Layer config: (col_name, relation_label, base_weight)
    layers = [
        ("l1_code", "industry_l1", 0.5),
        ("l2_code", "industry_l2", 0.8),
        ("l3_code", "industry_l3", 1.0),
    ]

    edges: list[tuple[str, str, str, float]] = []
    seen: dict[tuple[str, str, str], bool] = {}  # (layer, a, b) → seen

    for col, label, base in layers:
        if col not in df.columns:
            continue
        for _, group in df.groupby(col):
            symbols = sorted(group[sym_col].tolist())
            if len(symbols) < 2:
                continue
            weight = base / np.sqrt(len(symbols))
            for i, si in enumerate(symbols):
                for sj in symbols[i + 1:]:
                    key = (label, si, sj) if si < sj else (label, sj, si)
                    if key in seen:
                        continue
                    seen[key] = True
                    edges.append((si, sj, label, float(weight)))

    return edges


def build_concept_edges(
    concept_df: pd.DataFrame,
    universe: list[str],
    min_concept_size: int = 2,
    max_concept_size: int = 200,
) -> list[tuple[str, str, str, float]]:
    """Build edges between stocks in the same concept sector.

    Args:
        concept_df: DataFrame with [stock_symbol, concept_code] (from get_concept_constituents).
        universe: list of symbols to include.
        min_concept_size: skip concepts with fewer than this many stocks.
        max_concept_size: skip overly broad concepts (e.g. "沪深300" is not a useful signal).

    Returns:
        List of (src, dst, 'concept', weight) tuples. Weight is 1 / sqrt(N_concept).
    """
    df = concept_df.copy()
    sym_col = next((c for c in df.columns if c in ("stock_symbol", "symbol", "concept_stock")), None)
    # panda_data concept API returns concept_code or concept_name; normalize any code-like column
    con_col = next((c for c in df.columns if c in ("concept_code", "concept", "concept_name")), None)
    if sym_col is None or con_col is None:
        return []

    df[sym_col] = df[sym_col].astype(str)
    uni_set = set(universe)
    df = df[df[sym_col].isin(uni_set)]

    edges: list[tuple[str, str, str, float]] = []
    for concept, group in df.groupby(con_col):
        symbols = sorted(group[sym_col].tolist())
        n = len(symbols)
        if n < min_concept_size or n > max_concept_size:
            continue
        weight = 1.0 / np.sqrt(n)
        for i, si in enumerate(symbols):
            for sj in symbols[i + 1:]:
                edges.append((si, sj, "concept", float(weight)))

    return edges


def build_equity_edges(
    holders_df: pd.DataFrame,
    universe: list[str],
    min_overlap: int = 1,
) -> list[tuple[str, str, str, float]]:
    """Build edges between stocks sharing a top-10 institutional holder.

    Args:
        holders_df: DataFrame with [symbol, holder_name, holding_ratio] (from get_top_holders).
        universe: list of symbols to include.

    Returns:
        List of (src, dst, 'equity', weight) tuples. Weight = sum of min(ratio_i, ratio_j).
    """
    df = holders_df.copy()
    if "symbol" not in df.columns or "holder_name" not in df.columns:
        return []

    df["symbol"] = df["symbol"].astype(str)
    uni_set = set(universe)
    df = df[df["symbol"].isin(uni_set)]

    # holder → list of (symbol, ratio)
    holder_map: dict[str, list[tuple[str, float]]] = defaultdict(list)
    ratio_col = next((c for c in df.columns if c in ("holding_ratio", "ratio", "weight")), None)
    for _, row in df.iterrows():
        holder = str(row["holder_name"])
        ratio = float(row[ratio_col]) if ratio_col and pd.notna(row.get(ratio_col)) else 0.0
        holder_map[holder].append((str(row["symbol"]), ratio))

    edges: list[tuple[str, str, str, float]] = []
    seen = set()
    for holder, syms in holder_map.items():
        if len(syms) < 2:
            continue
        for i, (si, ri) in enumerate(syms):
            for sj, rj in syms[i + 1:]:
                key = tuple(sorted([si, sj]))
                if key in seen:
                    continue
                seen.add(key)
                weight = min(ri, rj) * 2  # scale up for readability
                edges.append((si, sj, "equity", float(weight)))

    return edges


def build_supply_chain_edges(
    universe: list[str],
) -> list[tuple[str, str, str, float]]:
    """Placeholder: supply chain edges require external data.

    Returns empty list in v0.1. Future versions could ingest supply-chain databases.
    """
    return []


def build_all_explicit_edges(
    industry_df: pd.DataFrame,
    concept_df: pd.DataFrame,
    holders_df: pd.DataFrame,
    universe: list[str],
    *,
    enable_industry: bool = True,
    enable_concept: bool = True,
    enable_equity: bool = True,
    enable_supply_chain: bool = False,
) -> list[tuple[str, str, str, float]]:
    """Build all explicit relation edges.

    Returns:
        Combined edge list: (src, dst, relation_type, weight).
    """
    edges: list[tuple[str, str, str, float]] = []

    if enable_industry:
        edges.extend(build_industry_edges(industry_df, universe))
    if enable_concept:
        edges.extend(build_concept_edges(concept_df, universe))
    if enable_equity:
        edges.extend(build_equity_edges(holders_df, universe))
    if enable_supply_chain:
        edges.extend(build_supply_chain_edges(universe))

    return edges
