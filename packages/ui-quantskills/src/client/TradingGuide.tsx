import { useId, useState, type ReactNode } from 'react'
import { CaretDownIcon, InfoIcon, QuestionIcon } from '@phosphor-icons/react'
import './TradingGuide.css'
import { ActionDialog } from './ActionDialog.tsx'

export type GuideStep = { title: string; status: string; ready?: boolean; body: string; note: string; action?: { label: string; run(): void } | undefined }

/** Navigation and explanation only: opening a guide never starts a trading operation. */
export function TradingGuide({ name, steps, troubleshooting, compact = false, triggerIcon, inDrawer = false }: {
  name: string; steps: GuideStep[]; troubleshooting: { title: string; body: string }[]; compact?: boolean; triggerIcon?: ReactNode; inDrawer?: boolean
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
  if (compact) return <><button type="button" className="qs-quick-help" onClick={() => setHelp(true)}>{triggerIcon}快速上手</button>{help && <ActionDialog drawer className="qs-support-drawer" title={`${name}快速上手`} onClose={() => setHelp(false)}><TradingGuide inDrawer name={name} steps={steps.map(item => ({ ...item, action: item.action ? { ...item.action, run: () => { setHelp(false); item.action!.run() } } : undefined }))} troubleshooting={troubleshooting}/></ActionDialog>}</>
  return <section className="qs-trading-guide" aria-label={`${name}新手引导`}>
    <header><div><strong>{inDrawer ? '完成运行前的准备' : `${name} · 从这里开始`}</strong><span>核对配置与行情，再确认执行方式。</span></div>
      {inDrawer ? <span className="qs-guide-step-count">{step + 1} / {steps.length} 步</span> : <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id}>{open ? '收起新手引导' : '打开新手引导'}</button>}</header>
    {(open || inDrawer) && <div id={id}>
      <nav aria-label={`${name}引导步骤`}>{steps.map((item, index) => <button type="button" key={item.title} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>
        <span>{index + 1}</span><div><b>{item.title}</b><small data-ready={item.ready}>{item.status}</small></div>
      </button>)}</nav>
      <div className="qs-guide-body"><span className="qs-guide-eyebrow">第 {step + 1} 步</span><h3>{current.title}</h3><p>{current.body}</p><div className="qs-guide-note"><InfoIcon size={16} aria-hidden="true"/><p>{current.note}</p></div>
        <div className="qs-guide-actions">{current.action && <button type="button" className="qs-guide-action" onClick={current.action.run}>{current.action.label} ↗</button>}</div>
        {steps.length > 1 && <div className="qs-guide-paging"><span>{step + 1} / {steps.length}</span><div>{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>上一步说明</button>}
          {step < steps.length - 1 && <button type="button" onClick={() => setStep(step + 1)}>下一步说明 →</button>}</div></div>}
      </div>
      {troubleshooting.length > 0 && <section className="qs-guide-help" aria-label="常见问题"><header><QuestionIcon size={18} aria-hidden="true"/><h3>常见问题</h3><span>{troubleshooting.length} 项</span></header>{troubleshooting.map(item => <details key={item.title}><summary><strong>{item.title}</strong><CaretDownIcon size={15} aria-hidden="true"/></summary><p>{item.body}</p></details>)}</section>}
    </div>}
  </section>
}
