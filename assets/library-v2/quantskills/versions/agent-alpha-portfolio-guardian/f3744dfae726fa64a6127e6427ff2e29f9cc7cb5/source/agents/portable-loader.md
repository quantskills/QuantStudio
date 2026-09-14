# Portable Loader（Hermes / OpenClaw / 无原生 Skill 机制）

将下列说明粘贴到宿主 Prompt，并把 `<REPO_ROOT>` 替换为本仓库绝对路径。

## 加载步骤

1. 将本仓库放入工作区，并确保四个依赖目录可访问：
   - `skill-factor-evaluate`
   - `skill-factor-decay`
   - `agent-crowding-risk-monitor`
   - `skill-smart-money-profiler`
2. 阅读 `<REPO_ROOT>/AGENTS.md`
3. `pip install -r <REPO_ROOT>/requirements.txt`
4. 复制 `.env.example` → 环境变量（live 且需在线取数时填 `PANDA_DATA_*`；勿写入仓库）
5. 运行：

```bash
cd <REPO_ROOT>
python -m runtime --mock
# 或
python -m runtime --portfolio config/portfolio.yaml --live
python -m runtime backtest --allow-simulate
```

6. 阅读 `reports/runtime_out/<run_id>/runtime_report.md` 与 `agent_snapshot.json`；回测打开 `reports/backtest/<run_id>/l4.html`

## 硬约束（必须注入宿主）

- 先读 `AGENTS.md`，再读依赖 Skill/Agent 文档
- 依赖失败必须标注缺口，禁止编造数值
- 禁止买入 / 卖出 / 必涨 / 仓位指令
- 输出仅供研究参考，不构成投资建议；不承诺收益
- 未经维护者审核，不得宣称 QuantSkills 官方背书
