import { useEffect, useRef, useState } from 'react'
import type { ModelAccessResponse } from '@deepseek-ai/dsh-quantskills-session/types'
import { ActionDialog } from './ActionDialog.tsx'
import { QuantSkillsModelServices, type ModelAccess } from './QuantSkillsModelServices.tsx'

// A vendor directory or saved route with a missing credential is not a configured model.
export const hasConfiguredModel = (data: ModelAccessResponse) => data.connections.some(connection =>
  connection.configured && connection.modelIds.some(id => id.trim().length > 0))

/** Lives in the application shell, so navigation never reopens a dismissed startup check. */
export function ModelStartup({ access }: { access: ModelAccess }) {
  const accessRef = useRef(access)
  accessRef.current = access
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<ModelAccessResponse>()
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    setError('')
    setBusy(true)
    void Promise.resolve().then(() => accessRef.current({ action: 'list' })).then(result => {
      if (!active) return
      setData(result)
      setOpen(!hasConfiguredModel(result))
    }, () => {
      if (!active) return
      setError('暂时无法检查模型配置，请重试。已有配置不会被修改。')
      setOpen(true)
    }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [attempt])
  if (!open) return null
  return <ActionDialog title={ready ? '模型已配置' : '配置大模型'} wide busy={busy} onClose={() => setOpen(false)}>
    {ready ? <><p>模型服务已保存，可以开始使用技能、专家和专家团。</p>
      <footer><button data-primary onClick={() => setOpen(false)}>开始使用</button></footer></>
      : error ? <><p role="alert">{error}</p><footer>
        <button disabled={busy} onClick={() => setOpen(false)}>稍后设置</button>
        <button data-primary disabled={busy} onClick={() => setAttempt(value => value + 1)}>重新检查</button>
      </footer></> : <>
        <p>还没有配置大模型。选择服务商并保存连接，即可开始研究；也可以稍后在「设置 → 模型服务」中完成。</p>
        <QuantSkillsModelServices access={access} initialData={data} initialAdding onBusyChange={setBusy}
          onSaved={result => { setData(result); setReady(hasConfiguredModel(result)) }}/>
        <footer><button disabled={busy} onClick={() => setOpen(false)}>稍后设置</button></footer>
      </>}
  </ActionDialog>
}
