"""GATs_ts: RNN + Dynamic Graph Attention Network for stock return prediction.

Architecture (from the paper, adapted for A-share daily frequency):

    Input: (N, lookback, D_price) per-stock windows
      │
      ├── RNN Encoder (GRU, 2-layer, hidden=64)
      │     └── Takes the flattened (lookback * D_price) reshaped as a sequence
      │         and outputs a temporal encoding h_i ∈ R^64 per stock
      │
      ├── Multi-Head GAT (4 heads × 32 dim)
      │     └── Operates on the graph adjacency; updates node embeddings
      │         via multi-head attention over neighbors
      │
      └── MLP Prediction Head
            [64+128 → 64 → 32 → 1]
            └── Scalar predicted return for each stock

Paper reference: "GATs_ts: RNN + Dynamic Graph Attention Network for Stock Ranking"
Reported: +28.9% annualized excess return over CSI300, IR 2.94
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from scripts.model.layers import MultiHeadGAT


class RNNEncoder(nn.Module):
    """GRU-based temporal encoder for per-stock time series.

    Takes a (N, T, D) tensor, runs a stacked GRU, and returns the final hidden state.
    """

    def __init__(
        self,
        input_dim: int,
        hidden_dim: int = 64,
        n_layers: int = 2,
        dropout: float = 0.2,
        rnn_type: str = "GRU",
    ) -> None:
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.n_layers = n_layers

        rnn_cls = nn.GRU if rnn_type.upper() == "GRU" else nn.LSTM
        self.rnn = rnn_cls(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=n_layers,
            batch_first=True,
            dropout=dropout if n_layers > 1 else 0.0,
        )
        self.rnn_type = rnn_type.upper()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Encode temporal features.

        Args:
            x: (N, T, D) where T=lookback and D=features_per_day.

        Returns:
            (N, hidden_dim) final hidden state.
        """
        _, h_n = self.rnn(x)  # h_n: (n_layers, N, hidden_dim) for GRU
        if self.rnn_type == "LSTM":
            h_n = h_n[0]  # take hidden state, ignore cell state
        # Take the last layer's hidden state
        return h_n[-1]  # (N, hidden_dim)


class GATsTS(nn.Module):
    """GATs_ts: RNN temporal encoder + Graph Attention + MLP prediction head.

    Args:
        input_dim: features per day (default N_ALL_FEATURES = 28).
        lookback: number of trading days in the window (default 20).
        rnn_hidden: GRU hidden dimension per layer.
        rnn_layers: stacked GRU layers.
        rnn_dropout: dropout between GRU layers.
        gat_heads: number of GAT attention heads.
        gat_hidden: per-head hidden dimension.
        gat_dropout: attention dropout.
        mlp_hidden: hidden dims of the prediction MLP (list).
        mlp_dropout: dropout in MLP.
    """

    def __init__(
        self,
        input_dim: int = 28,
        lookback: int = 20,
        rnn_hidden: int = 64,
        rnn_layers: int = 2,
        rnn_dropout: float = 0.2,
        gat_heads: int = 4,
        gat_hidden: int = 32,
        gat_dropout: float = 0.1,
        mlp_hidden: tuple[int, ...] = (64, 32),
        mlp_dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.input_dim = input_dim
        self.lookback = lookback
        self.rnn_hidden = rnn_hidden

        # Temporal encoder
        self.rnn_encoder = RNNEncoder(
            input_dim=input_dim,
            hidden_dim=rnn_hidden,
            n_layers=rnn_layers,
            dropout=rnn_dropout,
        )

        # Graph attention
        self.gat = MultiHeadGAT(
            n_heads=gat_heads,
            in_features=rnn_hidden,
            hidden_features=gat_hidden,
            dropout=gat_dropout,
        )
        gat_out_dim = gat_heads * gat_hidden

        # Prediction MLP
        mlp_dims = [rnn_hidden + gat_out_dim] + list(mlp_hidden) + [1]
        mlp_layers: list[nn.Module] = []
        for i in range(len(mlp_dims) - 1):
            mlp_layers.append(nn.Linear(mlp_dims[i], mlp_dims[i + 1]))
            if i < len(mlp_dims) - 2:
                mlp_layers.append(nn.ReLU())
                mlp_layers.append(nn.Dropout(mlp_dropout))
        self.mlp = nn.Sequential(*mlp_layers)

    def forward(
        self,
        x: torch.Tensor,
        adj: torch.Tensor,
    ) -> torch.Tensor:
        """Forward pass.

        Args:
            x: (N, lookback * input_dim) — flattened windows.
               Reshaped internally to (N, lookback, input_dim).
            adj: (N, N) normalized adjacency matrix.

        Returns:
            (N, 1) predicted return scores.
        """
        N = x.size(0)
        # Reshape flat input to (N, lookback, input_dim)
        if x.dim() == 2:
            x = x.view(N, self.lookback, self.input_dim)

        # 1. Temporal encoding
        h_temporal = self.rnn_encoder(x)           # (N, rnn_hidden)

        # 2. Graph encoding
        h_graph = self.gat(h_temporal, adj)        # (N, gat_out_dim)

        # 3. Concatenate & predict
        h = torch.cat([h_temporal, h_graph], dim=1)  # (N, rnn_hidden + gat_out_dim)
        out = self.mlp(h)                             # (N, 1)
        return out.squeeze(-1)                        # (N,)


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
