# Source Boundary

**Allowed**:
- JoinQuant Python strategy code provided by user
- PandaAI JSON strategy configuration files
- Public documentation of JoinQuant API (jqdata SDK)
- Public PandaAI API documentation
- Strategy backtest results from either platform
- Market data (prices, volumes) — conceptual understanding of data structures

**Not allowed** (unless user explicitly provides with authorization):
- Non-public JoinQuant strategy marketplace content
- Paywalled PandaAI enterprise documentation
- Other users' strategies without permission
- Platform-specific proprietary algorithms (e.g., JoinQuant's internal data processing)

**Conversion scope note**: This skill converts the strategy logic and trading rules. It does not guarantee:
- Identical backtest results (platform differences in fill algorithms, slippage models, and data sources will cause variations)
- Feature-for-feature parity (PandaAI may not support every JoinQuant API)
- Performance equivalence (same signals may produce different P&L due to execution differences)
