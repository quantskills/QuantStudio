import { useId, useState } from 'react'
import './TradingGuide.css'
import { ActionDialog } from './ActionDialog.tsx'

export type GuideStep = { title: string; status: string; ready?: boolean; body: string; note: string; action?: { label: string; run(): void } | undefined }

/** Navigation and explanation only: opening a guide never starts a trading operation. */
export function TradingGuide({ name, steps, troubleshooting, compact = false }: {
  name: string; steps: GuideStep[]; troubleshooting: { title: string; body: string }[]; compact?: boolean
}) {
  const [help, setHelp] = useState(false)
  const id = useId()
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(`qs-guide-v1-${name}`) !== 'closed' } catch { return true }
  })
  const [step, setStep] = useState(0)
  const current = steps[step]!
  function toggle() {
    setOpen(!open)
    try { localStorage.setItem(`qs-guide-v1-${name}`, open ? 'closed' : 'open') } catch { /* Private browsing may disable storage. */ }
  }
  if (compact) return <><button type="button" className="qs-quick-help" onClick={() => setHelp(true)}>快速上手</button>{help && <ActionDialog drawer title={`${name}快速上手`} onClose={() => setHelp(false)}><TradingGuide name={name} steps={steps.map(item => ({ ...item, action: item.action ? { ...item.action, run: () => { setHelp(false); item.action!.run() } } : undefined }))} troubleshooting={troubleshooting}/></ActionDialog>}</>
  return <section className="qs-trading-guide" aria-label={`${name}新手引导`}>
    <header><div><strong>{name} · 从这里开始</strong><span>配置 → 核验 → 运行 → 确认计划</span></div>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id}>{open ? '收起新手引导' : '打开新手引导'}</button></header>
    {open && <div id={id}>
      <nav aria-label={`${name}引导步骤`}>{steps.map((item, index) => <button type="button" key={item.title} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>
        <span>{index + 1}</span><div><b>{item.title}</b><small data-ready={item.ready}>{item.status}</small></div>
      </button>)}</nav>
      <div className="qs-guide-body"><h3>{current.title}</h3><p>{current.body}</p><p className="qs-guide-note">{current.note}</p>
        <div className="qs-guide-actions">{current.action && <button type="button" onClick={current.action.run}>{current.action.label} ↗</button>}
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>上一步说明</button>}
          {step < steps.length - 1 && <button type="button" onClick={() => setStep(step + 1)}>下一步说明 →</button>}</div>
      </div>
      <details className="qs-guide-help"><summary>卡在某一步？查看常见问题</summary>{troubleshooting.map(item => <div key={item.title}><b>{item.title}</b><p>{item.body}</p></div>)}</details>
    </div>}
  </section>
}
