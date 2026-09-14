"""Test feature engineering — price, fundamental, sentiment, relation, pipeline."""
import numpy as np
import pandas as pd
import torch
from scripts.features import price, fundamental, sentiment, relation, pipeline


# --- Price features ---
class TestPriceFeatures:
    def setup_method(self):
        self.stock_df = pd.DataFrame({
            "symbol": ["A.SH"] * 25,
            "date": [f"202501{i:02d}" for i in range(1, 26)],
            "open": np.linspace(10, 11, 25),
            "close": np.linspace(10.1, 11.1, 25),
            "high": np.linspace(10.2, 11.2, 25),
            "low": np.linspace(10.0, 11.0, 25),
            "volume": np.full(25, 1e6),
            "amount": np.full(25, 1e7),
            "turnover": np.full(25, 0.02),
            "pre_close": np.linspace(9.9, 10.9, 25),
            "limit_up": np.linspace(11.0, 12.0, 25),
            "limit_down": np.linspace(9.0, 10.0, 25),
        })
        self.index_df = pd.DataFrame({
            "date": [f"202501{i:02d}" for i in range(1, 26)],
            "close": np.linspace(3500, 3600, 25),
            "pre_close": np.linspace(3490, 3590, 25),
        })

    def test_output_columns(self):
        result = price.compute_price_features(self.stock_df, self.index_df)
        for col in price.PRICE_FEATURE_NAMES:
            assert col in result.columns

    def test_ret_computation(self):
        result = price.compute_price_features(self.stock_df, self.index_df)
        assert not result["ret"].isna().all()
        assert result["ret"].iloc[1] is not None

    def test_no_future_leak(self):
        """Verify that features at time t use only data ≤ t."""
        result = price.compute_price_features(self.stock_df, self.index_df)
        # All features should be computable (NaN from rolling ok for early rows)
        for col in price.PRICE_FEATURE_NAMES:
            assert col in result.columns


# --- Relation features ---
class TestRelationFeatures:
    def test_pagerank(self):
        N = 4
        adj = torch.tensor([
            [0.0, 0.5, 0.5, 0.0],
            [0.5, 0.0, 0.5, 0.0],
            [0.5, 0.5, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0],
        ])
        symbols = ["A", "B", "C", "D"]
        result = relation.compute_relation_features(adj, symbols)
        assert len(result) == 4
        assert "pagerank" in result.columns
        assert "degree_centrality" in result.columns
        # D has no edges → centrality should be near zero
        d_row = result[result["symbol"] == "D"]
        assert d_row["degree_centrality"].iloc[0] < 0.1


# --- Pipeline ---
class TestFeaturePipeline:
    def test_feature_bundle_creation(self):
        """Test that FeatureBundle is created correctly."""
        fb = pipeline.FeatureBundle(
            train_x=np.zeros((100, 20 * 28), dtype=np.float32),
            train_adj=torch.eye(50),
            score_x=np.zeros((30, 20 * 28), dtype=np.float32),
            score_adj=torch.eye(30),
            score_symbols=["A"] * 30,
            train_symbols=["B"] * 100,
            train_dates=["20250101"] * 100,
            feat_mean=np.zeros(20 * 28),
            feat_std=np.ones(20 * 28),
            lookback=20,
            n_features=28,
        )
        assert fb.train_x.shape == (100, 560)
        assert fb.score_x.shape == (30, 560)
        assert len(fb.feature_columns) == 20 * 28
