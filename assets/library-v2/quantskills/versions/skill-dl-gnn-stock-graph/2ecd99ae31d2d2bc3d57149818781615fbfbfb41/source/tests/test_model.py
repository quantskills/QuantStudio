"""Test GNN model layers and architectures."""
import numpy as np
import torch
from scripts.model import layers, gats_ts, mf_iamgcn, train


# --- GraphAttentionLayer ---
class TestGATLayer:
    def test_forward_shape(self):
        N, D_in, D_out = 5, 8, 4
        gat = layers.GraphAttentionLayer(D_in, D_out)
        x = torch.randn(N, D_in)
        adj = torch.rand(N, N)
        out = gat(x, adj)
        assert out.shape == (N, D_out)

    def test_multi_head_shape(self):
        N, D_in = 5, 64
        gat = layers.MultiHeadGAT(n_heads=4, in_features=D_in, hidden_features=32)
        x = torch.randn(N, D_in)
        adj = torch.rand(N, N)
        out = gat(x, adj)
        assert out.shape == (N, 4 * 32)


# --- GCN ---
class TestGCNLayer:
    def test_forward_shape(self):
        N, D_in, D_out = 5, 8, 4
        gcn = layers.GraphConvLayer(D_in, D_out)
        x = torch.randn(N, D_in)
        adj = torch.rand(N, N)
        out = gcn(x, adj)
        assert out.shape == (N, D_out)

    def test_stacked_gcn(self):
        N, D_in = 5, 64
        gcn = layers.StackedGCN(n_layers=3, in_features=D_in, hidden_features=64)
        x = torch.randn(N, D_in)
        adj = torch.rand(N, N)
        out = gcn(x, adj)
        assert out.shape == (N, 64)


# --- GATs_ts model ---
class TestGATsTS:
    def setup_method(self):
        self.lookback = 20
        self.input_dim = 28
        self.N = 10

    def test_forward_shape(self):
        model = gats_ts.GATsTS(input_dim=self.input_dim, lookback=self.lookback)
        x = torch.randn(self.N, self.lookback * self.input_dim)
        adj = torch.eye(self.N)
        out = model(x, adj)
        assert out.shape == (self.N,)
        assert torch.isfinite(out).all()

    def test_param_count(self):
        model = gats_ts.GATsTS(input_dim=self.input_dim, lookback=self.lookback)
        n = gats_ts.count_parameters(model)
        assert n > 10000  # GATs_ts should have > 10k params


# --- MF-IAMGCN model ---
class TestMFIAMGCN:
    def setup_method(self):
        self.lookback = 20
        self.N = 10

    def test_forward_shape(self):
        model = mf_iamgcn.MFIAMGCN(
            price_dim=14, fund_dim=7, lookback=self.lookback,
        )
        total_features = 28  # price + fundamental + sentiment + relation
        x = torch.randn(self.N, self.lookback * total_features)
        adj = torch.eye(self.N)
        out = model(x, adj)
        assert out.shape == (self.N,)
        assert torch.isfinite(out).all()


# --- Training ---
class TestTraining:
    def test_make_model(self):
        model = train._make_model("gats_ts", input_dim=28, lookback=20)
        assert isinstance(model, gats_ts.GATsTS)

        model = train._make_model("mf_iamgcn", input_dim=28, lookback=20)
        assert isinstance(model, mf_iamgcn.MFIAMGCN)

    def test_make_model_unknown_raises(self):
        import pytest
        with pytest.raises(ValueError):
            train._make_model("unknown", input_dim=28, lookback=20)

    def test_train_small(self):
        """End-to-end training on a tiny synthetic dataset."""
        N = 20
        D = 20 * 28  # lookback * n_features
        x = np.random.randn(N, D).astype(np.float32)
        adj = torch.eye(N)
        symbols = [f"S{i}.SH" for i in range(N)]

        result = train.train_model(
            x, adj, symbols,
            model_name="gats_ts",
            input_dim=28,
            lookback=20,
            epochs=3,
            seed=42,
        )
        assert result.model is not None
        assert result.n_epochs_ran >= 1
        assert result.final_val_loss > 0

    def test_score(self):
        N = 10
        D = 20 * 28
        x = np.random.randn(N, D).astype(np.float32)
        adj = torch.eye(N)
        symbols = [f"S{i}.SH" for i in range(N)]

        result = train.train_model(
            x, adj, symbols,
            model_name="gats_ts",
            input_dim=28,
            lookback=20,
            epochs=2,
            seed=42,
        )
        scores = train.score_stocks(result.model, x, adj)
        assert scores.shape == (N,)
        assert np.isfinite(scores).all()

    def test_reproducibility(self):
        """Same seed → same results."""
        N, D = 20, 20 * 28
        x = np.random.RandomState(42).randn(N, D).astype(np.float32)
        adj = torch.eye(N)
        symbols = [f"S{i}.SH" for i in range(N)]

        r1 = train.train_model(x, adj, symbols, model_name="gats_ts", input_dim=28, lookback=20, epochs=3, seed=42)
        r2 = train.train_model(x, adj, symbols, model_name="gats_ts", input_dim=28, lookback=20, epochs=3, seed=42)

        # Losses should be identical
        assert abs(r1.final_val_loss - r2.final_val_loss) < 1e-6
