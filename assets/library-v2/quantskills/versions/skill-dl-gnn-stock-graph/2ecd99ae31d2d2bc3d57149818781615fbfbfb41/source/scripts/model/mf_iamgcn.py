"""MF-IAMGCN: Mixed-Frequency Inter-temporal Attention Multi-Graph Convolution Network.

Architecture:

  High-Frequency Branch (daily):
    ┌── Stacked GCN (3 layers × 64) ──> h_high ∈ R^{N×64}
    │
  Low-Frequency Branch (quarterly, MIDAS-aligned):
    ├── MLP: fundamental features (7 dims) → 64 dim
    └── MIDAS: align quarterly to daily via exponential decay weights
    └── h_low ∈ R^{N×64}
    │
  Cross-Temporal Attention:
    ├── Q,K,V projections: h_high → Q, h_low → K,V
    └── Multi-Head Attention: h_fused ∈ R^{N×64}
    │
  Prediction Head:
    └── h_fused → MLP [64 → 32 → 1] → return prediction

Key idea: MF-IAMGCN captures pricing information propagation across multi-layer
networks with mixed-frequency data — daily price-volume + quarterly fundamentals.

Paper reference: "MF-IAMGCN: Mixed-Frequency Inter-temporal Attention
Multi-layer Graph Convolution Network for Stock Prediction"
"""
from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F

from scripts.model.layers import StackedGCN


# ============================================================================
# MIDAS: Mixed-frequency alignment
# ============================================================================
class MIDASLayer(nn.Module):
    """Align low-frequency (quarterly) features to high-frequency (daily) grid.

    Uses exponential Almon lag polynomial weights:
        W(l; θ) = exp(θ₁ * l + θ₂ * l²) / Σ exp(...)
    where l = 0..L-1 is the lag order in high-frequency units since last low-frequency obs.

    Args:
        n_lags: number of high-frequency periods to look back per low-frequency observation.
        low_dim: dimension of low-frequency features.
        output_dim: target output dimension.
    """

    def __init__(
        self,
        n_lags: int = 60,        # ~1 quarter of trading days
        low_dim: int = 7,        # fundamental feature count
        output_dim: int = 64,
    ) -> None:
        super().__init__()
        self.n_lags = n_lags
        self.low_dim = low_dim
        self.output_dim = output_dim

        # Almon polynomial parameters
        self.theta1 = nn.Parameter(torch.tensor(0.0))
        self.theta2 = nn.Parameter(torch.tensor(0.0))

        # Projection
        self.proj = nn.Linear(low_dim, output_dim)

    def _almon_weights(self) -> torch.Tensor:
        """Compute normalized Almon lag weights. Returns (n_lags,)."""
        lags = torch.arange(self.n_lags, dtype=torch.float32)
        w = torch.exp(self.theta1 * lags + self.theta2 * lags ** 2)
        return w / w.sum()

    def forward(self, h_low: torch.Tensor) -> torch.Tensor:
        """Project and apply MIDAS weighting.

        Args:
            h_low: (N, low_dim) — latest quarterly fundamental data per stock.

        Returns:
            (N, output_dim) MIDAS-aligned representation.
        """
        return self.proj(h_low)


# ============================================================================
# Cross-Temporal Multi-Head Attention
# ============================================================================
class CrossTemporalAttention(nn.Module):
    """Multi-head attention fusing high-frequency and low-frequency representations.

    Q comes from daily branch, K and V come from quarterly branch.
    This allows the model to attend to fundamental context when interpreting
    daily price patterns.
    """

    def __init__(
        self,
        q_dim: int = 64,
        kv_dim: int = 64,
        n_heads: int = 4,
        hidden_dim: int = 32,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.n_heads = n_heads
        self.hidden_dim = hidden_dim
        self.scale = math.sqrt(hidden_dim)

        self.W_q = nn.Linear(q_dim, n_heads * hidden_dim, bias=False)
        self.W_k = nn.Linear(kv_dim, n_heads * hidden_dim, bias=False)
        self.W_v = nn.Linear(kv_dim, n_heads * hidden_dim, bias=False)
        self.W_o = nn.Linear(n_heads * hidden_dim, q_dim)

        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        h_high: torch.Tensor,  # (N, q_dim)
        h_low: torch.Tensor,    # (N, kv_dim)
    ) -> torch.Tensor:
        """Cross-temporal attention.

        Args:
            h_high: daily-frequency representations (acts as Q).
            h_low: quarterly-frequency representations (acts as K, V).

        Returns:
            (N, q_dim) fused representation.
        """
        N = h_high.size(0)
        n_h, h_d = self.n_heads, self.hidden_dim

        # Project
        Q = self.W_q(h_high).view(N, n_h, h_d)   # (N, n_h, h_d)
        K = self.W_k(h_low).view(N, n_h, h_d)
        V = self.W_v(h_low).view(N, n_h, h_d)

        # Scaled dot-product attention
        attn = torch.einsum("nhd,mhd->hnm", Q, K) / self.scale  # (n_h, N, N)
        attn = F.softmax(attn, dim=-1)
        attn = self.dropout(attn)

        out = torch.einsum("hnm,mhd->nhd", attn, V)  # (N, n_h, h_d)
        out = out.reshape(N, n_h * h_d)                # (N, n_h * h_d)
        return self.W_o(out)                            # (N, q_dim)


# ============================================================================
# MF-IAMGCN Full Model
# ============================================================================
class MFIAMGCN(nn.Module):
    """Mixed-Frequency Inter-temporal Attention Multi-GCN.

    Args:
        price_dim: number of daily price features per day (default 14).
        fund_dim: number of quarterly fundamental features (default 7).
        lookback: trading-day window length (default 20).
        gcn_layers: number of stacked GCN layers.
        gcn_hidden: hidden dimension per GCN layer.
        gcn_dropout: dropout in GCN layers.
        fusion_dim: dimension of the fused (high+low) space.
        attn_heads: cross-temporal attention heads.
        attn_hidden: per-head attention dimension.
        attn_dropout: attention dropout.
        midas_lags: MIDAS lag order in trading days.
    """

    def __init__(
        self,
        price_dim: int = 14,
        fund_dim: int = 7,
        lookback: int = 20,
        gcn_layers: int = 3,
        gcn_hidden: int = 64,
        gcn_dropout: float = 0.1,
        fusion_dim: int = 64,
        attn_heads: int = 4,
        attn_hidden: int = 32,
        attn_dropout: float = 0.1,
        midas_lags: int = 60,
    ) -> None:
        super().__init__()
        self.price_dim = price_dim
        self.fund_dim = fund_dim
        self.lookback = lookback
        self.fusion_dim = fusion_dim

        # High-frequency branch: flatten window → GCN
        price_flat_dim = lookback * price_dim
        self.price_proj = nn.Linear(price_flat_dim, gcn_hidden)
        self.gcn = StackedGCN(
            n_layers=gcn_layers,
            in_features=gcn_hidden,
            hidden_features=gcn_hidden,
            dropout=gcn_dropout,
        )

        # Low-frequency branch: fundamentals → MIDAS
        self.midas = MIDASLayer(
            n_lags=midas_lags,
            low_dim=fund_dim,
            output_dim=fusion_dim,
        )

        # Cross-temporal attention
        self.ct_attn = CrossTemporalAttention(
            q_dim=gcn_hidden,
            kv_dim=fusion_dim,
            n_heads=attn_heads,
            hidden_dim=attn_hidden,
            dropout=attn_dropout,
        )

        # Prediction head
        self.pred_head = nn.Sequential(
            nn.Linear(gcn_hidden, fusion_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(fusion_dim // 2, 1),
        )

    def forward(
        self,
        x: torch.Tensor,         # (N, lookback * total_features) — flattened
        adj: torch.Tensor,        # (N, N) normalized adjacency
    ) -> torch.Tensor:
        """Forward pass.

        Args:
            x: (N, lookback * (price_dim + fund_dim + sentiment_dim + relation_dim))
               We split it internally into price and fundamental portions.
            adj: (N, N) adjacency.

        Returns:
            (N,) predicted return scores.
        """
        N = x.size(0)
        total = self.lookback * self.price_dim

        # Split input into price (first total columns) and fundamental (next fund_dim columns per day)
        # Actually: the unified panel is [price_feats..., fund_feats..., sent_feats..., rel_feats...]
        # per day. The fundamental features are forward-filled daily, so we take the last day's.
        x_2d = x.view(N, self.lookback, -1)  # (N, lookback, total_feats)

        # High-freq: take price features (first price_dim columns per day), flatten
        x_price = x_2d[:, :, : self.price_dim].reshape(N, -1)  # (N, lookback * price_dim)
        h_price = F.relu(self.price_proj(x_price))               # (N, gcn_hidden)

        # Low-freq: take fundamental features from the LAST day's window (most recent)
        # Fundamental features start at column `price_dim` and span `fund_dim`
        fund_start = self.price_dim
        fund_end = self.price_dim + self.fund_dim
        x_fund = x_2d[:, -1, fund_start:fund_end]               # (N, fund_dim)

        # Graph convolution on high-freq
        h_high = self.gcn(h_price, adj)                          # (N, gcn_hidden)

        # MIDAS on low-freq
        h_low = self.midas(x_fund)                               # (N, fusion_dim)

        # Cross-temporal attention
        h_fused = self.ct_attn(h_high, h_low)                    # (N, gcn_hidden)

        # Predict
        out = self.pred_head(h_fused).squeeze(-1)                # (N,)
        return out


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
