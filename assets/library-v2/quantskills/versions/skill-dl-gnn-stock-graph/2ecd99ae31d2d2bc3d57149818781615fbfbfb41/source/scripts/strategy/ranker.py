"""Learning-to-Rank utilities (v0.2 planned feature).

For v0.1, this module provides a placeholder for future RankNet / LambdaRank
training loss that directly optimizes stock ranking order.

Current approach: MSE loss on predicted vs actual return (see model/train.py).
v0.2: Replace MSE with pairwise ranking loss for better TopK alignment.
"""
from __future__ import annotations

import torch
import torch.nn as nn


class RankNetLoss(nn.Module):
    """Pairwise ranking loss (Burges et al. 2005).

    For each pair (i, j) where stock i has higher actual return than stock j,
    penalize the model if it scores j higher than i.

    L = Σ_{i,j: y_i > y_j} log(1 + exp(-(s_i - s_j)))

    This directly optimizes ranking order rather than pointwise MSE.
    """

    def __init__(self) -> None:
        super().__init__()

    def forward(self, scores: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """Compute pairwise ranking loss.

        Args:
            scores: (N,) predicted scores.
            targets: (N,) actual returns (or ranks).

        Returns:
            Scalar loss.
        """
        N = scores.size(0)
        if N < 2:
            return torch.tensor(0.0, device=scores.device)

        # Pairwise differences
        s_diff = scores.unsqueeze(0) - scores.unsqueeze(1)   # (N, N): s_i - s_j
        y_diff = targets.unsqueeze(0) - targets.unsqueeze(1)  # (N, N): y_i - y_j

        # Only consider pairs where y_i > y_j
        mask = (y_diff > 0).float()

        # Logistic loss
        loss = torch.log(1.0 + torch.exp(-s_diff)) * mask
        n_pairs = mask.sum()

        if n_pairs == 0:
            return torch.tensor(0.0, device=scores.device)

        return loss.sum() / n_pairs
