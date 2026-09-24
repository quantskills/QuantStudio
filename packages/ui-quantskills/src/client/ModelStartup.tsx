import { useEffect, useRef, useState } from 'react'
import type { ModelAccessResponse } from '@deepseek-ai/dsh-quantskills-session/types'
import { ActionDialog } from './ActionDialog.tsx'
import { QuantSkillsModelServices, type ModelAccess } from './QuantSkillsModelServices.tsx'
import type { FlyAccess } from './fly/transport.ts'
import type { FlyRuntimeStatus } from '@deepseek-ai/dsh-quantskills-session/src/fly-runtime.ts'

type FlyEnvironment = { brain_ready: boolean; blender_ready: boolean; progress: { status: string; stage?: string; message?: string; done?: number; total?: number } }

function FlyStartupPrepare({ access }: { access: FlyAccess }) {
  const [runtime, setRuntime] = useState<FlyRuntimeStatus>()
  const [environment, setEnvironment] = useState<FlyEnvironment>()
  const [blenderPath, setBlenderPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const next = await access.status()
        if (disposed) return
        setRuntime(next)
        if (next.installed && next.running) {
          const state = await access.request({ path: 'state' }) as { environment: FlyEnvironment }
          if (!disposed) setEnvironment(state.environment)
        }
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : '果蝇状态暂不可用') }
      finally { if (!disposed) timer = setTimeout(() => void poll(), 3000) }
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer) }
  }, [access])
  const ready = environment?.brain_ready && environment.blender_ready
  const progress = environment?.progress
  return <section aria-label="果蝇交易员运行环境">
    <h3>果蝇交易员运行环境</h3>
    <p>首次使用可在这里一键下载并校验专用 Python 与 MaleCNS。已有 Blender 可填写安装路径复用。</p>
    <p role="status">{ready ? '神经环境与 Blender 已就绪。' : progress?.status === 'error' ? `准备失败：${progress.message || '请重试'}` : runtime?.message || '正在检查果蝇环境…'}{progress?.status === 'running' && progress.message ? ` ${progress.message}` : ''}</p>
    {!!progress?.total && <progress value={progress.done ?? 0} max={progress.total} />}
    {!ready && runtime?.supported && <><label>已有 Blender 安装路径（可选）<input value={blenderPath} onChange={event => setBlenderPath(event.target.value)} disabled={busy || runtime.installing} placeholder="安装目录或 blender.exe 的完整路径" /></label>
      <button type="button" disabled={busy || runtime.installing || progress?.status === 'running'} onClick={() => {
        setBusy(true); setError('')
        void access.install({ blenderPath: blenderPath.trim() }).then(setRuntime).catch(cause => setError(cause instanceof Error ? cause.message : '准备失败，请重试')).finally(() => setBusy(false))
      }}>{runtime.installing || progress?.status === 'running' ? '正在准备…' : '一键准备果蝇 / 重试'}</button></>}
    {error && <p role="alert">{error}</p>}
  </section>
}

// A vendor directory or saved route with a missing credential is not a configured model.
export const hasConfiguredModel = (data: ModelAccessResponse) => data.connections.some(connection =>
  connection.configured && connection.modelIds.some(id => id.trim().length > 0))

/** Lives in the application shell, so navigation never reopens a dismissed startup check. */
export function ModelStartup({ access, flyAccess }: { access: ModelAccess; flyAccess?: FlyAccess }) {
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
    {ready ? <p>模型服务已保存，可以开始使用技能、专家和专家团。</p>
      : error ? <p role="alert">{error}</p>
        : <p>还没有配置大模型。选择服务商并保存连接，即可开始研究；也可以稍后在「设置 → 模型服务」中完成。</p>}
    {flyAccess && <FlyStartupPrepare access={flyAccess}/>}
    {!ready && !error && <QuantSkillsModelServices access={access} initialData={data} initialAdding onBusyChange={setBusy}
      onSaved={result => { setData(result); setReady(hasConfiguredModel(result)) }}/>
    }
    <footer>{ready ? <button data-primary onClick={() => setOpen(false)}>开始使用</button> : <>
      <button disabled={busy} onClick={() => setOpen(false)}>稍后设置</button>
      {error && <button data-primary disabled={busy} onClick={() => setAttempt(value => value + 1)}>重新检查</button>}
    </>}</footer>
  </ActionDialog>
}
