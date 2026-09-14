# 历史因子证据面板库（live 账本）

**仅** `source_mode` 为 `live` / `degraded` 的研究态会把 `health_matrix` 按 `(date, factor_id)` 写入：

- `metrics_panel.parquet`（优先）
- `metrics_panel.csv`（旁路，便于人工检视）

mock / self-test **不会**写入本目录。

回测须显式选源（三选一）：

```powershell
python -m runtime backtest --from-panel-store
python -m runtime backtest --metrics-panel path.csv
python -m runtime backtest --allow-simulate
```

- panel store 至少 **2 个 as_of 日** 才能拼后验（默认下一期 `rank_ic` 近似）
- 本目录数据默认不入库（见根 `.gitignore`）
