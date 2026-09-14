# skill-daily-report

A cross-market daily review skill for China A-shares, Hong Kong, US, Japan and Korea markets, plus gold and crude oil. It combines public market data, sector performance, capital-flow context and news into a structured Markdown report.

## Usage

Requires Python 3.9+ and `requests`:

```bash
python3 -m pip install requests
python3 scripts/fetch_market_data.py
```

Load the root `SKILL.md` in a compatible runtime and ask for a daily or global market review. The collector writes `/tmp/daily_report_data.json`; the runtime supplements sectors, flows and news with public search tools before producing the report.

Sectors, capital flows and news should be supplemented from public 10jqka (同花顺) pages when permitted, with other public sources used for cross-checking. Data may be delayed or unavailable because of market holidays, network failures, access restrictions, or upstream format changes. Reports are for research and information purposes only and are not investment advice or a promise of returns.

## License

GNU General Public License v3.0 only. See [LICENSE](LICENSE).
