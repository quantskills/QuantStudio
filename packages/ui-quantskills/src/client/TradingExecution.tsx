import type { TradingExecutionMode } from '@deepseek-ai/dsh-quantskills-session/src/trading-execution.ts'
// Keep the browser protocol version type-checked without importing the host plugin.
export const AUTOMATIC_TRADING_CONSENT: typeof import('@deepseek-ai/dsh-quantskills-session/src/trading-execution.ts').AUTOMATIC_TRADING_CONSENT = 'automatic-orders-v1'
export type { TradingExecutionMode }

export function ExecutionModeChoice({ value, onChange, disabled = false }: {
  value: TradingExecutionMode; onChange(value: TradingExecutionMode): void; disabled?: boolean
}) {
  return <section className="qs-execution-choice" aria-label="执行方式">
    <h3>执行方式</h3>
    <div className="qs-execution-options">
      <button type="button" disabled={disabled} aria-pressed={value === 'manual'} onClick={() => onChange('manual')}>
        <strong>逐笔确认</strong><span>先看计划，确认后下单</span>
      </button>
      <button type="button" disabled={disabled} aria-pressed={value === 'automatic'} onClick={() => onChange('automatic')}>
        <strong>自动下单</strong><span>启动时授权，之后自动提交</span>
      </button>
    </div>
    <p>{value === 'automatic' ? '启动前会展示本次范围与风险，确认后才会自动执行。' : '信号生成计划后，在「交易计划与回执」核对并确认；未确认不会下单。'}</p>
  </section>
}

export function ExecutionDisclosure({ mode, accepted, onChange }: {
  mode: TradingExecutionMode; accepted: boolean; onChange(value: boolean): void
}) {
  if (mode === 'manual') return <p className="qs-execution-disclosure">本轮逐笔确认。系统生成计划后等待你确认，确认前不会提交委托。模型调用仍会产生用量。</p>
  return <section className="qs-execution-disclosure" aria-label="自动下单说明与风险">
    <strong>本轮将直接向期货模拟赛账户提交委托</strong>
    <ul>
      <li>符合策略和额度条件即通过 CLI 下单，不再逐笔询问。模型可能判断错误，可能连续亏损。</li>
      <li>市价 IOC 可能滑点、部分成交或未成交；断网和接口延迟可能影响下单、平仓和回执。</li>
      <li>损失停止线只停止后续委托，不保证最大亏损。暂停不撤单、不平仓；后台运行时关闭页面也不会停止交易。</li>
      <li>本轮仅按上方账户、合约和设置执行。模型调用可能产生 API 费用。</li>
    </ul>
    <label><input type="checkbox" checked={accepted} onChange={event => onChange(event.target.checked)} />我已理解上述风险，授权本轮自动下单</label>
  </section>
}
