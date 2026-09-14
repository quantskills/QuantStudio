"""Multi-layer heterogeneous graph builder.

Combines explicit and implicit edge lists into a single heterogeneous graph
represented as PyG `HeteroData` (torch_geometric).

Node types:
  - 'stock': the main entity; carries the 298-dim feature vector

Edge types (each is a relation layer):
  - ('stock', 'industry', 'stock')
  - ('stock', 'concept', 'stock')
  - ('stock', 'equity', 'stock')
  - ('stock', 'dtw', 'stock')
  - ('stock', 'correlation', 'stock')
  - ('stock', 'granger', 'stock')          — directed: src→dst

The builder:
  1. Aligns all symbols to consecutive node indices (0..N-1)
  2. Converts each edge list to a COO edge_index tensor
  3. Optionally combines all relations into a single weighted adjacency
     (for homogeneous GNNs like GATs_ts that expect a single graph)
"""
from __future__ import annotations

import numpy as np
import torch


# ---------------------------------------------------------------------------
# Symbol ↔ Index mapping
# ---------------------------------------------------------------------------
class SymbolMapper:
    """Bi-directional mapping between stock symbols and integer node indices."""

    def __init__(self, symbols: list[str]) -> None:
        self._s2i: dict[str, int] = {s: i for i, s in enumerate(sorted(symbols))}
        self._i2s: dict[int, str] = {i: s for s, i in self._s2i.items()}
        self.n: int = len(self._s2i)

    def index(self, symbol: str) -> int | None:
        return self._s2i.get(symbol)

    def symbol(self, idx: int) -> str | None:
        return self._i2s.get(idx)

    @property
    def symbols(self) -> list[str]:
        return [self._i2s[i] for i in range(self.n)]


# ---------------------------------------------------------------------------
# Edge list → COO tensor
# ---------------------------------------------------------------------------
def _edges_to_coo(
    edges: list[tuple[str, str, str, float]],
    mapper: SymbolMapper,
    directed: bool = False,
) -> tuple[torch.Tensor, torch.Tensor | None]:
    """Convert a typed edge list to (edge_index, edge_weight) tensors.

    Args:
        edges: list of (src, dst, rel_type, weight).
        mapper: symbol→index mapping.
        directed: if False, adds reverse edges for undirected relations.

    Returns:
        edge_index: (2, E) LongTensor.
        edge_weight: (E,) FloatTensor, or None if no weights.
    """
    rows: list[int] = []
    cols: list[int] = []
    weights: list[float] = []

    for src, dst, _rel, w in edges:
        si = mapper.index(src)
        di = mapper.index(dst)
        if si is None or di is None:
            continue
        rows.append(si)
        cols.append(di)
        weights.append(w)
        if not directed:
            rows.append(di)
            cols.append(si)
            weights.append(w)

    if not rows:
        return torch.zeros((2, 0), dtype=torch.long), None

    edge_index = torch.tensor([rows, cols], dtype=torch.long)
    edge_weight = torch.tensor(weights, dtype=torch.float32)
    return edge_index, edge_weight


# ---------------------------------------------------------------------------
# Combined adjacency matrix (for homogeneous GNN)
# ---------------------------------------------------------------------------
def build_weighted_adjacency(
    all_edges: list[tuple[str, str, str, float]],
    mapper: SymbolMapper,
    relation_weights: dict[str, float] | None = None,
) -> torch.Tensor:
    """Build a single (N, N) weighted adjacency matrix from all edge types.

    Args:
        all_edges: combined edge list from all relation types.
        mapper: symbol→index mapping.
        relation_weights: optional per-relation-type scalar weight (e.g. {'industry': 1.0, 'dtw': 0.5}).
                          If None, defaults to 1.0 for all types.

    Returns:
        (N, N) FloatTensor — A[i,j] = sum of weighted edges from i to j.
    """
    if relation_weights is None:
        # Default: equity edges are noisy (many-to-many via large institutions),
        # so down-weight them to avoid drowning industry/DTW/correlation signals.
        relation_weights = {
            "industry_l1": 1.0, "industry_l2": 1.2, "industry_l3": 1.5,
            "concept": 0.8, "equity": 0.2, "dtw": 1.0, "correlation": 1.0,
            "granger": 0.5,
        }

    N = mapper.n
    A = np.zeros((N, N), dtype=np.float32)

    for src, dst, rel, w in all_edges:
        si = mapper.index(src)
        di = mapper.index(dst)
        if si is None or di is None:
            continue
        rw = relation_weights.get(rel, 1.0)
        A[si, di] += w * rw
        # For undirected types (all except 'granger'), add symmetric edge
        if rel != "granger":
            A[di, si] += w * rw

    # Symmetric normalization (D^{-1/2} A D^{-1/2})
    deg = A.sum(axis=1)
    deg_inv_sqrt = np.where(deg > 0, 1.0 / np.sqrt(deg), 0.0)
    D_inv_sqrt = np.diag(deg_inv_sqrt)
    A_norm = D_inv_sqrt @ A @ D_inv_sqrt

    return torch.from_numpy(A_norm.astype(np.float32))


# ---------------------------------------------------------------------------
# Graph build summary
# ---------------------------------------------------------------------------
def summarize_edges(
    all_edges: list[tuple[str, str, str, float]],
) -> dict[str, int]:
    """Count edges per relation type."""
    from collections import Counter
    cnt = Counter(rel for _, _, rel, _ in all_edges)
    return dict(cnt)


def build_full_graph(
    symbols: list[str],
    explicit_edges: list[tuple[str, str, str, float]],
    implicit_edges: list[tuple[str, str, str, float]],
    relation_weights: dict[str, float] | None = None,
) -> tuple[SymbolMapper, torch.Tensor, dict[str, int]]:
    """Build the complete homogeneous graph representation.

    Args:
        symbols: universe stock symbols.
        explicit_edges: from build_all_explicit_edges().
        implicit_edges: from build_all_implicit_edges().
        relation_weights: optional per-relation scalar weights.

    Returns:
        (mapper, adjacency_matrix, edge_summary).
    """
    mapper = SymbolMapper(symbols)
    all_edges = explicit_edges + implicit_edges
    adj = build_weighted_adjacency(all_edges, mapper, relation_weights)
    summary = summarize_edges(all_edges)
    return mapper, adj, summary
