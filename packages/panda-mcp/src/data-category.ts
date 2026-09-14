/** Research subject and storage shape are independent: financial reports can have dates. */
export type DataCategory = 'market' | 'news' | 'fundamental' | 'other'
export const DATA_CATEGORIES: readonly DataCategory[] = ['market', 'news', 'fundamental', 'other']

export function inferDataCategory(input: { name: string; category?: DataCategory; source?: { method?: string }; columns?: string[] }): DataCategory {
  if (input.category && DATA_CATEGORIES.includes(input.category)) return input.category
  const classify = (text: string): DataCategory | undefined => {
    if (/(?:^|[^a-z])(news|headline|article|announcement|notice)(?:[^a-z]|$)|新闻|资讯|快讯|公告|舆情/i.test(text)) return 'news'
    if (/(?:^|[^a-z])(fina|financial|fundamental|balance|income|cashflow|valuation|dividend|shareholder|company|companies)(?:[^a-z]|$)|基本面|财务|财报|业绩|估值|股东|公司资料|企业名录|分红/i.test(text)) return 'fundamental'
    if (/(?:^|[^a-z])(quote|quotes|price|prices|ohlcv|kline|tick|ticks|daily|minute|intraday|bar|bars|market|orderbook|trade|trades)(?:[^a-z]|$)|行情|价格|成交|盘口|逐笔|日线|分钟线|K线/i.test(text)) return 'market'
    return undefined
  }
  // A known endpoint is stronger evidence than a user-supplied title.
  const named = classify(input.source?.method ?? '') ?? classify(input.name)
  if (named) return named
  const columns = new Set((input.columns ?? []).map(column => column.toLowerCase()))
  if (['headline', 'news_title', 'article_title', '新闻标题'].some(column => columns.has(column)) || (columns.has('title') && ['content', 'url', 'published_at', 'pub_time'].some(column => columns.has(column)))) return 'news'
  if ([...columns].some(column => /^(bs_|is_|cfs_|roe|eps|revenue|net_profit|total_assets|equity_parent)/.test(column)) || ['营收', '净利润', '总资产'].some(column => columns.has(column))) return 'fundamental'
  if (['close', 'open', 'last_price', 'bid_price', 'ask_price', '收盘价', '开盘价'].some(column => columns.has(column))) return 'market'
  return 'other'
}
