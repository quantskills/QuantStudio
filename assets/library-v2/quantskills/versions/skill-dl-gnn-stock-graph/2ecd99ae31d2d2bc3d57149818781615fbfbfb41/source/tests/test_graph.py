"""Test graph builder and explicit/implicit edge construction."""
import numpy as np
import torch
from scripts.graph import builder, explicit, implicit


# --- SymbolMapper ---
class TestSymbolMapper:
    def test_basic_mapping(self):
        symbols = ["600519.SH", "000001.SZ", "000858.SZ"]
        mapper = builder.SymbolMapper(symbols)
        assert mapper.n == 3
        assert mapper.index("600519.SH") is not None
        assert mapper.symbol(mapper.index("600519.SH")) == "600519.SH"

    def test_sorted_output(self):
        symbols = ["C", "A", "B"]
        mapper = builder.SymbolMapper(symbols)
        assert mapper.symbols == sorted(symbols)


# --- Edge building ---
class TestExplicitEdges:
    def test_industry_edges_empty_universe(self):
        import pandas as pd
        # panda_data returns l1_code, not industry_code
        df = pd.DataFrame({"stock_symbol": ["A", "B"], "l1_code": ["公用事业", "公用事业"]})
        edges = explicit.build_industry_edges(df, ["A", "B"])
        # L1 layer edge: only l1_code column exists
        assert len(edges) == 1
        assert edges[0][2] == "industry_l1"


class TestImplicitEdges:
    def test_correlation_empty_price(self):
        import pandas as pd
        df = pd.DataFrame(columns=["symbol", "date", "close", "pre_close"])
        edges = implicit.build_correlation_edges(df, [], lookback=20)
        assert edges == []


# --- Full graph ---
class TestBuildFullGraph:
    def test_empty_graph(self):
        mapper, adj, summary = builder.build_full_graph([], [], [])
        assert mapper.n == 0
        assert adj.shape == (0, 0)
        assert summary == {}

    def test_simple_graph(self):
        symbols = ["A.SH", "B.SH", "C.SH"]
        exp_edges = [("A.SH", "B.SH", "industry_l1", 1.0)]
        imp_edges = [("B.SH", "C.SH", "dtw", 0.8)]
        mapper, adj, summary = builder.build_full_graph(symbols, exp_edges, imp_edges)
        assert mapper.n == 3
        assert adj.shape == (3, 3)
        assert summary["industry_l1"] == 1
        assert summary["dtw"] == 1
        # Symmetric normalization should produce finite values
        assert torch.isfinite(adj).all()

    def test_weighted_adjacency_positive(self):
        symbols = ["A.SH", "B.SH"]
        edges = [("A.SH", "B.SH", "correlation", 0.9)]
        mapper = builder.SymbolMapper(symbols)
        adj = builder.build_weighted_adjacency(edges, mapper)
        # Should be non-negative and contain edges
        assert adj.min() >= 0
        assert adj[0, 1] > 0
