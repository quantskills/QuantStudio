/** Resident workflows registered only in the competition agent's scope. */
export const CONTEST_WORKFLOWS = [
  {
    name: 'contest-account-check', description: '读取账户、持仓、活动委托和未完成回执，生成简短账户巡检。',
    content: '进入比赛会话时先调用 quantskills_contest_inspect，报告数据时间、资金、持仓、活动委托和待处理回执。区分未成交、已成交和未知状态。巡检只读，不生成交易计划。没有持仓不代表必须开仓；不要从空仓推断用户的交易偏好。',
  },
  {
    name: 'contest-research-plan', description: '研究现有持仓或用户指定的品种，形成可复核方案。',
    content: '默认范围是当前持仓和用户指定的品种。先核对数据是否覆盖所需品种和日期，最新报价不是历史行情。用 quantskills_data_catalog 查已配置数据，quantskills_data_query 必须传 refresh=false；缺少或过期时说明缺口，请用户在数据库页准备数据，不编造指标。研究结论按：结论、依据与数据时间、对当前账户的影响、候选方案和退出条件、下一步。退出条件是研究计划，不代表已挂出止损单。只有用户明确选择方案后才读取执行规范、补齐参数并预演。',
  },
  {
    name: 'contest-daily-review', description: '对照交易计划、实际委托和成交，复盘本交易日。',
    content: '先查询今天的委托、成交（date=today）和结算；用 quantskills_contest_journal 读取本账户已保存的计划及回执。对比原计划与实际执行、成本和盈亏、尚未核实事项及待观察条件。实时权益和结算成绩分开，不把未实现盈亏当已结算收益。复盘不自动生成订单或修改策略约束；用户确认的约束保留在本账户主对话中，账户事实每次重新读取。',
  },
] as const
