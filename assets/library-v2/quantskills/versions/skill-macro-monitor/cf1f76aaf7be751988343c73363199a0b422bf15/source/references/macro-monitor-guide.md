# Macro Monitor Guide

Load this file when a request requires more than a quick one-indicator answer, when building a report, or when setting up a recurring monitor.

## Request Triage

| User intent | Minimum data plan | Useful expansion |
|---|---|---|
| `查 CPI/PMI/GDP/社融/M2` | `get_macro_detail` plus the matching China macro method | Add 3-5 year history and latest release-date check |
| `本周经济数据日历` | `get_macro_cal_config`, `get_macro_cal` | Add `get_macro_cal_info` for important releases |
| `宏观周报/月报` | National accounts, industry, prosperity, prices, finance, money/credit, rates, trade, domestic demand, employment | Add calendar and high-frequency confirmation |
| `行业景气度` | Matching industry method plus `get_macro_detail` | Add high-frequency specialty methods and cross-industry ranking |
| `设置监控/提醒` | Calendar or indicator watchlist plus threshold rules | Add post-release comparison and summary template |

Default windows:

- Single latest indicator: latest available point plus previous point and same period last year when available.
- Monthly indicators: 36 months for trend, 60 months for percentile context.
- Quarterly indicators: 12 quarters for trend, 20 quarters for percentile context.
- Annual indicators: 10 years for structural context.
- High-frequency indicators: latest 52 weeks or 12 months unless the method is daily and the user asks for shorter tracking.
- Economic calendar: today through the next 14 days for upcoming events; previous 7 days for post-release review.

## Indicator Discovery Pattern

1. Search with `get_macro_detail` using Chinese and English keywords when useful, such as `CPI`, `居民消费价格`, `PMI`, `制造业采购经理指数`, `社会融资规模`, `M2`, or an industry name.
2. Record all plausible matches with method category, indicator code, name, frequency, unit, and source/update metadata if returned.
3. Prefer official, broad, seasonally standard indicators over narrow sub-items unless the user asked for the sub-item.
4. If several codes are equally plausible, show 2-4 candidates and ask the user to choose.
5. Only after code confirmation, call the category method with the exact documented parameters from `pandadata-api`.

## Macro Method Routing

| Theme | Methods | Typical questions |
|---|---|---|
| Indicator metadata | `get_macro_detail` | What code should be used for CPI, PMI, GDP, M2, exports, or an industry indicator? |
| National accounts | `get_macro_na` | GDP, value added, final consumption, capital formation, income accounts |
| Industry and production | `get_macro_in` | Industrial value added, output, capacity or industrial structure |
| Prosperity indexes | `get_macro_ci` | PMI, business climate, sentiment or leading indicators |
| Prices | `get_macro_pi` | CPI, PPI, commodity or price-index pressure |
| Fixed assets | `get_macro_fa` | Infrastructure, manufacturing, real estate investment |
| Fiscal | `get_macro_fi` | Fiscal revenue, expenditure, deficit, government fund income |
| Money and banking | `get_macro_mb` | M2, credit, social financing, deposits, loans |
| Interest rates and FX | `get_macro_ir` | Policy rates, market rates, exchange rates |
| External sector | `get_macro_fe` | Imports, exports, trade balance, foreign investment |
| Domestic trade | `get_macro_dt` | Retail sales, consumption structure, wholesale/retail activity |
| Employment and wages | `get_macro_ew` | Unemployment, wages, labor market |
| Living standards | `get_macro_li` | Income, consumption expenditure, household indicators |
| Population and resources | `get_macro_pr` | Demographics, resources, energy or environmental aggregates |
| Science, education, culture, health | `get_macro_se` | Social-sector macro indicators |
| Securities market | `get_macro_sm` | Market financing, securities-market macro statistics |
| Regional macro | `get_macro_pm` | Province or city macro data |
| International macro | `get_macro_gb` | Global or country-level macro comparison |

## Industry And Specialty Routing

| Sector | Methods |
|---|---|
| 农林牧渔 | `get_macro_ag` |
| 能源 | `get_macro_en` |
| 化工 | `get_macro_ch` |
| 钢铁 | `get_macro_st` |
| 有色金属 | `get_macro_nf` |
| 建材 | `get_macro_bm` |
| 汽车 | `get_macro_au` |
| 机械设备 | `get_macro_me` |
| 电子电器 | `get_macro_ee` |
| TMT | `get_macro_tm` |
| 食品饮料 | `get_macro_fb` |
| 纺织服装 | `get_macro_te` |
| 造纸印刷 | `get_macro_pp` |
| 医药生物 | `get_macro_ph` |
| 公用事业 | `get_macro_ut` |
| 交通运输 | `get_macro_tr` |
| 房地产及建筑业 | `get_macro_rc` |
| 旅游酒店 | `get_macro_th` |
| 文教体娱及工艺品 | `get_macro_ce` |
| 批发零售业 | `get_macro_wr` |
| 金融保险业 | `get_macro_fs` |
| 行业综合 | `get_macro_is` |

| High-frequency specialty | Methods |
|---|---|
| 线上电商 | `get_macro_ec` |
| 医药 | `get_macro_md` |
| 能化 | `get_macro_eh` |
| 汽车 | `get_macro_ad` |
| 家电 | `get_macro_ha` |
| 线下商超 | `get_macro_of` |
| 招聘 | `get_macro_rb` |
| 房地产 | `get_macro_re` |
| 电子 | `get_macro_ed` |
| 电新 | `get_macro_ep` |
| 农业 | `get_macro_ar` |
| 大宗 | `get_macro_cm` |

## Economic Calendar Workflow

Use this when the user asks for upcoming releases, weekly calendars, event reminders, or post-release review.

1. Use `get_macro_cal_config` to identify supported event types and subscription filters.
2. Use `get_macro_cal` for the requested date window.
3. Use `get_macro_cal_info` for important events or when the user asks for details.
4. Build the table: release time, country/region, event, previous value, forecast/consensus if available, actual value if released, importance, related watchlist indicators, and follow-up action.
5. For post-release review, compare actual vs previous and forecast, then state market/macro implication as inference.

## Report Skeletons

### Quick Indicator Answer

1. 结论: one paragraph with latest reading and direction.
2. 数据表: indicator, method, code, frequency, period, value, unit, release/update date.
3. 变化: previous-period and year-on-year comparison.
4. 解读: 2-4 points, clearly labeled as inference.
5. 数据限制: stale date, missing forecast, calculation note, or empty result.

### Macro Weekly Or Monthly Report

1. 摘要结论: 3-5 bullets with confidence and contradictions.
2. 数据范围: methods, query windows, latest periods, and missing-data notes.
3. 总量与生产: GDP, industrial production, PMI or climate indexes.
4. 价格: CPI, PPI, commodity or sector price pressure.
5. 需求结构: fixed asset investment, consumption, trade.
6. 货币信用与利率汇率: M2, social financing, rates, FX.
7. 就业收入与财政: labor, wages, fiscal position.
8. 行业与高频验证: industry prosperity and specialty data.
9. 经济日历: key upcoming releases and watchlist.
10. 风险与限制: stale periods, revisions, asynchronous evidence, and data gaps.
11. 附录: method/parameter table and row counts.

### Industry Prosperity Report

1. 行业结论: direction, strength, confidence, and biggest contradiction.
2. 产业链拆分: demand, supply, price, inventory, exports, investment, financing.
3. 高频验证: specialty method signals where available.
4. 历史位置: percentile or z-score only after checking enough comparable history.
5. 关注事件: next data releases, policy events, or seasonality.
6. 附录: methods, codes, units, windows, row counts.

## Monitoring Contract

When the user wants scheduled monitoring, first return a spec like this and ask for confirmation before creating a real automation:

```yaml
monitor_name: macro-weekly-calendar
timezone: Asia/Shanghai
schedule: every Monday 08:30
watchlist:
  - indicator: CPI
    discovery_method: get_macro_detail
    data_method: get_macro_pi
    trigger: new_release_or_revision
  - indicator: 社会融资规模
    discovery_method: get_macro_detail
    data_method: get_macro_mb
    trigger: new_release_or_revision
output:
  format: markdown
  sections:
    - upcoming_calendar
    - released_data_review
    - surprises_vs_previous_or_forecast
    - next_watchlist
```

Monitoring rules:

- Use release-date windows, not calendar dates alone; macro data often arrives with lag and revisions.
- Track revisions. If an old period changes, label it as revision rather than new-period data.
- Alert thresholds can be absolute, directional, percentile-based, or forecast-surprise based; ask when the user has not supplied thresholds and the alert would be consequential.
- Include a "no new data" message for empty monitoring runs so silence is not mistaken for successful publication.

## Quality Checks

- Every chart, table, and claim has method, parameters, latest period, and unit.
- All indicator codes came from `get_macro_detail` or exact Pandadata docs in the current task.
- Mixed frequencies are clearly labeled and not treated as same-date confirmation.
- Empty results are documented rather than hidden.
- Formal reports include the research-use disclaimer.
