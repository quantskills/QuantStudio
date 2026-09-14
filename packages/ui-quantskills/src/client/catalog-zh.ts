/** Display-only translations of published catalog metadata; asset identities stay unchanged. */
export const CATALOG_ZH: Readonly<Record<string, { title: string; summary: string }>> = {
  'skill-a-share-market-participation': { title: 'A股市场参与度分析', summary: '分析市场广度、成交集中度、流动性分布与交易拥挤程度，判断上涨是否由少数龙头推动，生成可复核的市场结构报告。仅用于研究，不执行交易。' },
  'skill-causal-alpha-discovery': { title: '因果因子发现', summary: '基于量价数据进行因果发现与结构建模，构造跨市场状态的因子表达式，并通过回测检验稳定性。' },
  'skill-dl-transformer-multiasset': { title: '多资产 Transformer 因子研究', summary: '使用 PatchTST 或 iTransformer 研究商品期货收益因子，支持训练、评估与只读查询，不执行交易。' },
  'skill-futures-investment-council': { title: '期货投资研究委员会', summary: '结合技术指标与期货市场结构，对品种进行分析、比较和筛选，输出委员会式研究报告。' },
  'skill-hk-us-fundamental-factor': { title: '港美股基本面因子', summary: '构建、标准化并验证港美股多因子面板，支持质量、价值、成长、动量与低风险因子的综合评分和筛选。' },
  'skill-hk-us-institutional-concentration': { title: '港美股机构持仓集中度', summary: '分析机构持股覆盖度、大股东主导程度与持仓集中度，比较股权结构并评估证据可信度。' },
  'skill-microstructure-vwap-deviation': { title: 'VWAP 偏离策略研究', summary: '基于分钟行情研究滚动 VWAP 偏离、均值回归与趋势过滤，结合执行成本、冻结数据回测和交易结果复核。' },
  'skill-rl-portfolio-allocator': { title: '强化学习组合配置', summary: '研究基于 PPO 的沪深300因子权重配置，使用滚动样本验证，仅支持离线研究及经批准的成果发布。' },
  'skill-stock-score': { title: '股票评分研究', summary: '股票评分类研究技能。目录尚未提供完整简介，可打开技能说明查看具体输入和使用方式。' },
  'skill-tqx-data-research': { title: 'TQX 数据研究', summary: 'TQX 数据研究与报告技能。目录尚未提供完整简介，可打开技能说明查看适用范围。' },
}

export const hasChinese = (text: string) => /[\u3400-\u9fff]/u.test(text)
