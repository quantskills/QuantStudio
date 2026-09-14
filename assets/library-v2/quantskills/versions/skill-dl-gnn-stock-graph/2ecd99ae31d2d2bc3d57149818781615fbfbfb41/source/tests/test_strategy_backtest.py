"""Test strategy, backtest, and risk modules."""
import numpy as np
import pandas as pd
import torch
from scripts.strategy import selector, ranker
from scripts.backtest import rules, metrics, engine
from scripts.model import train as model_train
from scripts.risk import monitor


# --- Strategy ---
class TestSelector:
    def test_top_k_empty(self):
        result = selector.select_top_k(np.array([]), [], top_k=10)
        assert result.empty

    def test_top_k_basic(self):
        scores = np.array([0.1, 0.5, 0.3, 0.8, 0.2])
        symbols = ["A", "B", "C", "D", "E"]
        result = selector.select_top_k(scores, symbols, top_k=3)
        assert len(result) == 3
        assert result["symbol"].iloc[0] == "D"  # highest score

    def test_min_score_filter(self):
        scores = np.array([0.1, 0.5, 0.3])
        symbols = ["A", "B", "C"]
        result = selector.select_top_k(scores, symbols, top_k=10, min_score=0.4)
        assert len(result) == 1
        assert result["symbol"].iloc[0] == "B"


class TestRankNetLoss:
    def test_loss_computed(self):
        import torch
        loss_fn = ranker.RankNetLoss()
        scores = torch.tensor([0.1, 0.9, 0.5])
        targets = torch.tensor([0.01, 0.05, 0.02])
        loss = loss_fn(scores, targets)
        assert loss.item() >= 0


# --- Trading Rules ---
class TestTradingRules:
    def test_can_buy_normal(self):
        ok, reason = rules.can_buy("600519.SH", 100, 1800.0, 1980.0, 1810.0)
        assert ok
        assert reason == "ok"

    def test_can_buy_limit_up(self):
        ok, reason = rules.can_buy("600519.SH", 100, 1800.0, 1980.0, 1980.0)
        assert not ok
        assert reason == "limit_up"

    def test_can_buy_suspended(self):
        ok, reason = rules.can_buy("600519.SH", 100, 1800.0, 1980.0, 1800.0, trade_status=1)
        assert not ok
        assert reason == "suspended"

    def test_can_sell_normal(self):
        ok, reason = rules.can_sell("600519.SH", 200, 100, 1620.0, 1810.0)
        assert ok
        assert reason == "ok"

    def test_can_sell_t1(self):
        ok, reason = rules.can_sell("600519.SH", 200, 100, 1620.0, 1810.0, t_plus_1_held=False)
        assert not ok
        assert reason == "t_plus_1"

    def test_fill_price(self):
        buy_price = rules.fill_price(100.0, "buy")
        assert buy_price > 100.0
        sell_price = rules.fill_price(100.0, "sell")
        assert sell_price < 100.0

    def test_trade_cost(self):
        cost = rules.trade_cost(1000, 10.0, "buy")
        assert cost > 0
        cost_sell = rules.trade_cost(1000, 10.0, "sell")
        assert cost_sell > cost  # sell includes stamp tax


# --- Backtest Metrics ---
class TestMetrics:
    def test_compute_metrics(self):
        nav_df = pd.DataFrame({
            "date": ["20250102", "20250103", "20250106"],
            "nav": [1_000_000.0, 1_010_000.0, 1_005_000.0],
        })
        m = metrics.compute_metrics(nav_df)
        assert "sharpe_ratio" in m
        assert "max_drawdown" in m

    def test_turnover_zero(self):
        trades = pd.DataFrame(columns=["date", "symbol", "qty", "price", "direction"])
        assert metrics.compute_turnover(trades) == 0.0


# --- Backtest Engine ---
class TestBacktestEngine:
    def test_run(self):
        picks = {
            "20250102": pd.DataFrame({"rank": [1], "symbol": ["A.SH"], "score": [0.9]}),
            "20250103": pd.DataFrame({"rank": [1], "symbol": ["A.SH"], "score": [0.8]}),
        }
        prices = pd.DataFrame({
            "symbol": ["A.SH", "A.SH"],
            "date": ["20250102", "20250103"],
            "close": [10.0, 10.5],
        })
        cfg = engine.BacktestConfig(start_date="20250102", end_date="20250103")
        port = engine.run_backtest(picks, prices, cfg)
        assert len(port.nav_history) > 0
        assert port.nav > 0


# --- Risk Monitor ---
class TestRiskMonitor:
    def test_market_risk_empty(self):
        r = monitor.market_risk_check(pd.DataFrame())
        assert r["is_high_vol"] is False

    def test_concentration_check(self):
        positions = {"A.SH": 100000.0, "B.SH": 50000.0}
        r = monitor.concentration_check(positions, 1_000_000.0, max_single=0.05)
        assert r["is_concentrated"]  # A is 10%
        assert len(r["over_concentrated"]) == 1

    def test_systemic_risk(self):
        adj = np.array([
            [0.0, 0.5, 0.5],
            [0.5, 0.0, 0.5],
            [0.5, 0.5, 0.0],
        ])
        symbols = ["A.SH", "B.SH", "C.SH"]
        r = monitor.systemic_risk_from_graph(adj, symbols, top_n=2)
        assert len(r["top_systemic_symbols"]) == 2


# --- Future Leak Tests ---
class TestNoFutureLeak:
    def test_selector_no_lookahead(self):
        """Scores and selection depend only on model output, not future prices."""
        scores = np.array([0.5, 0.3, 0.8])
        symbols = ["A.SH", "B.SH", "C.SH"]
        result = selector.select_top_k(scores, symbols, top_k=3)
        assert len(result) == 3
        # Highest score first
        assert result["symbol"].iloc[0] == "C.SH"

    import torch
    from scripts.model import train as model_train
    # ... existing code ...

    def test_training_split_no_leak(self):
        """Train/val split is on symbols, not time — no temporal leakage."""
        N = 50
        x = np.random.randn(N, 100).astype(np.float32)
        adj = torch.eye(N)
        symbols = [f"S{i}.SH" for i in range(N)]

        tr_x, va_x, tr_adj, va_adj, tr_syms, va_syms, tr_nidx, va_nidx = model_train._split_train_val_by_symbols(
            x, adj, symbols, symbols, val_frac=0.2, seed=42,
        )
        # No symbol should appear in both sets
        assert set(tr_syms).isdisjoint(set(va_syms))
        # Total count preserved
        assert len(tr_syms) + len(va_syms) == N
