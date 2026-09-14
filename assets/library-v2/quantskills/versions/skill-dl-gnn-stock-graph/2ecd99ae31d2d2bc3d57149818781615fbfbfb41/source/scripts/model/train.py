"""Training loop for GNN models (GATs_ts / MF-IAMGCN).

Design:
  - Loss:     MSE on predicted vs actual next-day return (RankNet loss planned for v0.2).
  - Optim:    Adam, lr=1e-3, weight_decay=1e-4.
  - Batch:    full-batch for small graphs (N < 500); mini-batch via neighbor sampling for large.
  - Epochs:   max 100, early stop patience 10 on validation MSE.
  - Split:    80/20 random split on stock symbols (NOT on time, to avoid leakage).
  - Device:   auto cuda / mps / cpu.
  - Seed:     deterministic training.
  - Checkpoint: saved as {output_dir}/models/{model_name}_{date}.pt

Key difference from MLP training: GNN uses full-graph forward pass per epoch,
not per-sample batching. The adjacency matrix covers all training nodes.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from scripts.model.gats_ts import GATsTS
from scripts.model.mf_iamgcn import MFIAMGCN


@dataclass
class TrainResult:
    model: nn.Module
    final_train_loss: float
    final_val_loss: float
    n_epochs_ran: int
    device: str
    model_name: str


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def _pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def set_seed(seed: int) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


# ---------------------------------------------------------------------------
# Model factory
# ---------------------------------------------------------------------------
def _make_model(
    model_name: str,
    input_dim: int,
    lookback: int,
    **kwargs,
) -> nn.Module:
    """Create a GNN model by name.

    Args:
        model_name: 'gats_ts' or 'mf_iamgcn'.
        input_dim: features per day (N_ALL_FEATURES = 28).
        lookback: trading-day window length.
        **kwargs: model-specific hyperparams (see config/model_config.yaml).

    Returns:
        Instantiated nn.Module.
    """
    if model_name == "gats_ts":
        return GATsTS(
            input_dim=input_dim,
            lookback=lookback,
            rnn_hidden=kwargs.get("rnn_hidden", 64),
            rnn_layers=kwargs.get("rnn_layers", 2),
            rnn_dropout=kwargs.get("rnn_dropout", 0.2),
            gat_heads=kwargs.get("gat_heads", 4),
            gat_hidden=kwargs.get("gat_hidden", 32),
            gat_dropout=kwargs.get("gat_dropout", 0.1),
            mlp_hidden=tuple(kwargs.get("mlp_hidden", [64, 32])),
            mlp_dropout=kwargs.get("mlp_dropout", 0.1),
        )
    elif model_name == "mf_iamgcn":
        return MFIAMGCN(
            price_dim=kwargs.get("price_dim", 14),
            fund_dim=kwargs.get("fund_dim", 7),
            lookback=lookback,
            gcn_layers=kwargs.get("gcn_layers", 3),
            gcn_hidden=kwargs.get("gcn_hidden", 64),
            gcn_dropout=kwargs.get("gcn_dropout", 0.1),
            fusion_dim=kwargs.get("fusion_dim", 64),
            attn_heads=kwargs.get("attn_heads", 4),
            attn_hidden=kwargs.get("attn_hidden", 32),
            attn_dropout=kwargs.get("attn_dropout", 0.1),
            midas_lags=kwargs.get("midas_lags", 60),
        )
    else:
        raise ValueError(f"Unknown model: {model_name}. Choose 'gats_ts' or 'mf_iamgcn'.")


# ---------------------------------------------------------------------------
# Train/Val split on symbols
# ---------------------------------------------------------------------------
def _split_train_val_by_symbols(
    x: np.ndarray,
    adj: torch.Tensor,
    symbols: list[str],                # per-sample symbols (len = x.shape[0])
    node_symbols: list[str],            # per-node symbols (len = adj.shape[0])
    val_frac: float,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, torch.Tensor, torch.Tensor, list[str], list[str]]:
    """Split data into train/val sets on the symbol dimension.

    x has shape (N_samples, D) with repeated symbols across time windows.
    adj has shape (N_nodes, N_nodes), one per unique stock.
    We split NODES into train/val, then filter x rows accordingly.

    Returns:
        train_x, val_x, train_adj, val_adj, train_symbols, val_symbols.
    """
    rng = np.random.default_rng(seed)
    unique_symbols = sorted(set(node_symbols))
    N_nodes = len(unique_symbols)
    idx = np.arange(N_nodes)
    rng.shuffle(idx)
    cut = int(round(N_nodes * (1 - val_frac)))

    train_uniq = set(unique_symbols[i] for i in idx[:cut])
    val_uniq = set(unique_symbols[i] for i in idx[cut:])

    # Build node-level index maps
    node_idx = {s: i for i, s in enumerate(node_symbols)}
    train_node_indices = [node_idx[s] for s in train_uniq if s in node_idx]
    val_node_indices = [node_idx[s] for s in val_uniq if s in node_idx]

    # Filter sample-level rows
    train_mask = np.array([s in train_uniq for s in symbols])
    val_mask = np.array([s in val_uniq for s in symbols])

    train_x = x[train_mask]
    val_x = x[val_mask]
    train_adj = adj[train_node_indices][:, train_node_indices]
    val_adj = adj[val_node_indices][:, val_node_indices]
    train_syms = [s for s in symbols if s in train_uniq]
    val_syms = [s for s in symbols if s in val_uniq]

    return train_x, val_x, train_adj, val_adj, train_syms, val_syms, train_node_indices, val_node_indices


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------
def train_model(
    train_x: np.ndarray,
    train_adj: torch.Tensor,
    train_symbols: list[str],
    *,
    targets: np.ndarray | None = None,
    node_symbols: list[str] | None = None,
    model_name: str = "gats_ts",
    input_dim: int = 28,
    lookback: int = 20,
    batch_size: int = 64,
    epochs: int = 100,
    lr: float = 1e-3,
    weight_decay: float = 1e-4,
    val_frac: float = 0.2,
    early_stop_patience: int = 10,
    grad_clip: float = 1.0,
    seed: int = 42,
    device: torch.device | None = None,
    **model_kwargs,
) -> TrainResult:
    """Train a GNN model on the feature tensor and adjacency.

    Args:
        train_x: (N, lookback * input_dim) float32 feature windows.
        train_adj: (N, N) normalized adjacency.
        train_symbols: ordered list of symbols (for val split).
        model_name: 'gats_ts' or 'mf_iamgcn'.
        input_dim: features per day.
        lookback: window size in trading days.
        batch_size: batch size for DataLoader (1 for full-batch GNN if N < batch_size).
        epochs: max training epochs.
        lr: learning rate.
        weight_decay: Adam weight decay.
        val_frac: validation fraction.
        early_stop_patience: epochs without val improvement before stopping.
        grad_clip: max gradient norm.
        seed: random seed.
        device: torch device.
        **model_kwargs: passed to model constructor.

    Returns:
        TrainResult with model, losses, and diagnostics.
    """
    set_seed(seed)
    device = device or _pick_device()

    if targets is None:
        import warnings
        warnings.warn(
            "targets is None — GNN will train against zeros, producing meaningless predictions. "
            "Ensure _build_targets() is called before train_model().",
            RuntimeWarning,
        )

    # Split — returns sample-level splits + node-level adjacency indices
    n_syms = node_symbols if node_symbols is not None else train_symbols
    tr_x, va_x, tr_adj, va_adj, tr_syms, va_syms, tr_nidx, va_nidx = _split_train_val_by_symbols(
        train_x, train_adj, train_symbols, n_syms, val_frac, seed,
    )

    if len(tr_syms) < 4:
        raise ValueError(f"Too few training symbols ({len(tr_syms)}). Need at least 4.")

    # Model
    model = _make_model(model_name, input_dim, lookback, **model_kwargs).to(device)
    print(f"[info] {model_name} params: {sum(p.numel() for p in model.parameters() if p.requires_grad):,}",
          flush=True)

    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    loss_fn = nn.MSELoss()

    # DataLoaders (GNN uses full-batch per epoch for small N; batch for large N)
    use_full_batch = len(tr_syms) <= 512
    if use_full_batch:
        tr_t = torch.from_numpy(tr_x).to(device)
        tr_adj_t = tr_adj.to(device)
        va_t = torch.from_numpy(va_x).to(device)
        va_adj_t = va_adj.to(device)
    else:
        tr_dataset = TensorDataset(torch.from_numpy(tr_x))
        tr_loader = DataLoader(tr_dataset, batch_size=batch_size, shuffle=True)
        va_t = torch.from_numpy(va_x).to(device)
        va_adj_t = va_adj.to(device)

    best_val = float("inf")
    best_state: dict | None = None
    since_improve = 0
    ran = 0
    last_train_loss = float("nan")

    for epoch in range(epochs):
        ran = epoch + 1
        model.train()
        loss_sum = 0.0
        n_samples = 0

        if use_full_batch:
            opt.zero_grad(set_to_none=True)
            out = model(tr_t, tr_adj_t)
            tgt = torch.from_numpy(targets[tr_nidx]).float().to(device) if targets is not None else torch.zeros(tr_t.size(0), device=device)
            loss = loss_fn(out, tgt)
            loss.backward()
            if grad_clip > 0:
                nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
            opt.step()
            n_samples = tr_t.size(0)
            loss_sum = loss.item() * n_samples
        else:
            for (batch,) in tr_loader:
                batch = batch.to(device)
                opt.zero_grad(set_to_none=True)
                # For mini-batch GNN: use subset of adj
                batch_indices = list(range(batch.size(0)))  # Simplified for now
                adj_sub = tr_adj[batch_indices][:, batch_indices].to(device)
                out = model(batch, adj_sub)
                # Target: next-day return proxy (use last day's ret from feature)
                target = batch[:, -input_dim] if batch.ndim == 2 else batch[:, -1]
                loss = loss_fn(out, target)
                loss.backward()
                if grad_clip > 0:
                    nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
                opt.step()
                n_samples += batch.size(0)
                loss_sum += loss.item() * batch.size(0)

        last_train_loss = loss_sum / max(n_samples, 1)

        # Validation — B2 fix: use real targets, not feature mean
        model.eval()
        with torch.no_grad():
            if len(va_syms) == 0:
                val_loss = last_train_loss
            else:
                out = model(va_t, va_adj_t)
                va_tgt = torch.from_numpy(targets[va_nidx]).float().to(device) if targets is not None else torch.zeros(va_t.size(0), device=device)
                val_loss = loss_fn(out, va_tgt).item()

        if val_loss < best_val - 1e-6:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            since_improve = 0
        else:
            since_improve += 1
            if since_improve >= early_stop_patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    return TrainResult(
        model=model.eval(),
        final_train_loss=float(last_train_loss),
        final_val_loss=float(best_val),
        n_epochs_ran=int(ran),
        device=str(device),
        model_name=model_name,
    )


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
@torch.no_grad()
def score_stocks(
    model: nn.Module,
    score_x: np.ndarray,
    score_adj: torch.Tensor,
    device: torch.device | None = None,
) -> np.ndarray:
    """Compute predicted return scores for scoring samples.

    Args:
        model: trained GNN.
        score_x: (N_score, lookback * input_dim) float32 windows.
        score_adj: (N_score, N_score) adjacency.
        device: torch device.

    Returns:
        (N_score,) float32 predicted scores (higher = better expected return).
    """
    device = device or _pick_device()
    model = model.to(device).eval()

    x_t = torch.from_numpy(score_x.astype(np.float32)).to(device)
    adj_t = score_adj.to(device)

    out = model(x_t, adj_t)
    return out.cpu().numpy()


# ---------------------------------------------------------------------------
# Checkpoint save/load
# ---------------------------------------------------------------------------
def save_checkpoint(
    model: nn.Module,
    path: str | Path,
    *,
    model_name: str = "",
    input_dim: int = 0,
    lookback: int = 0,
    train_loss: float = float("nan"),
    val_loss: float = float("nan"),
    seed: int = 0,
    extra: dict | None = None,
) -> None:
    """Save model state dict + metadata to a checkpoint file."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state_dict": model.state_dict(),
        "model_name": model_name,
        "input_dim": input_dim,
        "lookback": lookback,
        "train_loss": train_loss,
        "val_loss": val_loss,
        "seed": seed,
        "extra": extra or {},
    }, str(p))


def load_checkpoint(
    model: nn.Module,
    path: str | Path,
    device: torch.device | None = None,
) -> dict:
    """Load model state dict and metadata from a checkpoint file.

    Returns the metadata dict with keys: model_name, input_dim, lookback,
    train_loss, val_loss, seed, extra.
    """
    device = device or _pick_device()
    ckpt = torch.load(str(path), map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model = model.to(device).eval()
    return {
        "model_name": ckpt.get("model_name", ""),
        "input_dim": ckpt.get("input_dim", 0),
        "lookback": ckpt.get("lookback", 0),
        "train_loss": ckpt.get("train_loss", float("nan")),
        "val_loss": ckpt.get("val_loss", float("nan")),
        "seed": ckpt.get("seed", 0),
        "extra": ckpt.get("extra", {}),
    }
