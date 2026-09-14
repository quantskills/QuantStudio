"""Shared GNN layers used by all models — GATConv, GCNConv, message passing utilities.

Design note:
  torch_geometric is the standard GNN library. However, to keep this skill
  compatible with environments that may not have PyG installed (it requires
  torch-scatter, torch-sparse, etc.), the core layers are implemented here
  in pure PyTorch. This also makes the models transparent for debugging.

Paper references:
  - GAT: Velickovic et al. 2018 (ICLR)
  - GCN: Kipf & Welling 2017 (ICLR)
"""
from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================================================
# Graph Attention Layer (pure PyTorch)
# ============================================================================
class GraphAttentionLayer(nn.Module):
    """Single graph attention head.

    Args:
        in_features: input feature dimension per node.
        out_features: output feature dimension per node.
        dropout: attention dropout probability.
        alpha: LeakyReLU negative slope.
        concat: if True, apply ELU after; if False (last layer), average.
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        dropout: float = 0.1,
        alpha: float = 0.2,
        concat: bool = True,
    ) -> None:
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.dropout = dropout
        self.alpha = alpha
        self.concat = concat

        self.W = nn.Parameter(torch.empty(in_features, out_features))
        self.a = nn.Parameter(torch.empty(2 * out_features, 1))
        self.leakyrelu = nn.LeakyReLU(alpha)
        self.dropout_layer = nn.Dropout(dropout)

        self._reset_parameters()

    def _reset_parameters(self) -> None:
        nn.init.xavier_uniform_(self.W, gain=math.sqrt(2))
        nn.init.xavier_uniform_(self.a, gain=math.sqrt(2))

    def forward(
        self,
        x: torch.Tensor,          # (N, in_features)
        adj: torch.Tensor,        # (N, N) sparse-ish adjacency, normalized
    ) -> torch.Tensor:
        """Forward pass.

        Args:
            x: node features.
            adj: weighted adjacency matrix (edge weights).

        Returns:
            (N, out_features) updated node embeddings.
        """
        N = x.size(0)
        h = torch.mm(x, self.W)                    # (N, out)
        h = self.dropout_layer(h)

        # Attention scores: e_ij = LeakyReLU(a^T [Wh_i || Wh_j])
        # Compute pairwise concatenations efficiently
        a1 = torch.mm(h, self.a[: self.out_features])    # (N, 1)
        a2 = torch.mm(h, self.a[self.out_features:])     # (N, 1)
        e = a1 + a2.T                                     # (N, N)
        e = self.leakyrelu(e)

        # Mask attention to graph structure
        zero_vec = -9e15 * torch.ones_like(e)
        attention = torch.where(adj > 0, e, zero_vec)
        attention = F.softmax(attention, dim=1)          # row-wise
        attention = self.dropout_layer(attention)

        h_prime = torch.mm(attention, h)                 # (N, out)

        if self.concat:
            return F.elu(h_prime)
        else:
            return h_prime


class MultiHeadGAT(nn.Module):
    """Stack of multi-head Graph Attention Layers.

    Args:
        n_heads: number of attention heads.
        in_features: input dimension.
        hidden_features: per-head hidden dimension.
        dropout: attention dropout.
    """

    def __init__(
        self,
        n_heads: int = 4,
        in_features: int = 64,
        hidden_features: int = 32,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.n_heads = n_heads
        self.in_features = in_features
        self.hidden_features = hidden_features

        self.attentions = nn.ModuleList([
            GraphAttentionLayer(in_features, hidden_features, dropout=dropout, concat=True)
            for _ in range(n_heads)
        ])
        self.out_att = GraphAttentionLayer(
            hidden_features * n_heads, hidden_features * n_heads,
            dropout=dropout, concat=False,
        )

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """Multi-head GAT forward pass.

        Args:
            x: (N, in_features).
            adj: (N, N) adjacency.

        Returns:
            (N, hidden_features * n_heads).
        """
        head_outputs = [att(x, adj) for att in self.attentions]
        h = torch.cat(head_outputs, dim=1)
        h = self.out_att(h, adj)
        return h


# ============================================================================
# Graph Convolution Layer (pure PyTorch)
# ============================================================================
class GraphConvLayer(nn.Module):
    """Simple graph convolution: H' = σ(D^{-1/2} A D^{-1/2} H W).

    Uses the normalized adjacency directly — no additional normalization needed.
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        bias: bool = True,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features

        self.W = nn.Parameter(torch.empty(in_features, out_features))
        if bias:
            self.bias = nn.Parameter(torch.empty(out_features))
        else:
            self.register_parameter("bias", None)
        self.dropout = nn.Dropout(dropout)

        self._reset_parameters()

    def _reset_parameters(self) -> None:
        nn.init.xavier_uniform_(self.W, gain=math.sqrt(2))
        if self.bias is not None:
            fan_in, _ = nn.init._calculate_fan_in_and_fan_out(self.W)
            bound = 1 / math.sqrt(fan_in) if fan_in > 0 else 0
            nn.init.uniform_(self.bias, -bound, bound)

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """GCN forward: H' = ReLU(adj @ x @ W + bias)."""
        h = torch.mm(adj, torch.mm(x, self.W))
        if self.bias is not None:
            h = h + self.bias
        h = F.relu(h)
        h = self.dropout(h)
        return h


class StackedGCN(nn.Module):
    """Stack of multiple GCN layers."""

    def __init__(
        self,
        n_layers: int = 3,
        in_features: int = 64,
        hidden_features: int = 64,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        layers: list[nn.Module] = []
        prev = in_features
        for _ in range(n_layers):
            layers.append(GraphConvLayer(prev, hidden_features, dropout=dropout))
            prev = hidden_features
        self.layers = nn.ModuleList(layers)
        self.out_dim = hidden_features

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x, adj)
        return x
