import { useEffect, useRef, useState } from 'react'
import type { QuantSkillsManualSkillSaveRequest } from '@deepseek-ai/dsh-quantskills-host/types'
import { ActionDialog } from './ActionDialog.tsx'
import css from './capability-editor.module.css'

export type ManualSkillSave = (request: QuantSkillsManualSkillSaveRequest) => Promise<{ assetId: string }>
export interface ManualSkillSource {
  versionId: QuantSkillsManualSkillSaveRequest['sourceVersionId']; name: string; personal: boolean
  read(signal: AbortSignal): Promise<string>
}

export function ManualSkillEditor({ source, save, onSaved, onClose }: {
  source?: ManualSkillSource | undefined; save: ManualSkillSave; onSaved(assetId: string): void; onClose(): void
}) {
  const [identity] = useState(() => `skill-user-${crypto.randomUUID()}`)
  const [markdown, setMarkdown] = useState(`---\nname: ${identity}\ndescription: 描述技能的用途和适用场景。\n---\n\n# 我的技能\n\n## 执行步骤\n1. 检查用户提供的输入。\n2. 按要求处理，并说明数据来源。\n\n## 交付与检查\n- 输出结果和检查依据；遇到缺失信息时明确说明。\n`)
  const [initial, setInitial] = useState(markdown)
  const [loading, setLoading] = useState(!!source), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [ready, setReady] = useState(!source)
  const [discard, setDiscard] = useState(false), [reload, setReload] = useState(0)
  const lock = useRef(false), live = useRef(true), back = useRef<HTMLButtonElement>(null)
  useEffect(() => { live.current = true; back.current?.focus(); return () => { live.current = false } }, [])
  useEffect(() => {
    if (!source) return
    const controller = new AbortController()
    setLoading(true); setError('')
    void source.read(controller.signal).then(value => {
      if (!controller.signal.aborted) { setMarkdown(value); setInitial(value); setLoading(false); setReady(true) }
    }, cause => { if (!controller.signal.aborted) { setError(String(cause)); setLoading(false) } })
    return () => controller.abort()
  }, [source, reload])
  const mode = !source ? 'create' : source.personal ? 'edit' : 'copy'
  const close = () => { if (!lock.current) { if (markdown !== initial) setDiscard(true); else onClose() } }
  return <section className={css.editor} aria-label="手动编辑技能">
    <button ref={back} type="button" className={css.back} disabled={busy} onClick={close}>← 返回技能库</button>
    <header><small>我的创建 · 技能</small><h1>{mode === 'create' ? '创建技能' : mode === 'copy' ? '另存为我的技能' : '编辑技能'}</h1>
      <p>{source ? `基于「${source.name}」的固定版本，保留脚本和其他资源。` : '填写用途和执行说明，直接保存，无需调用模型或创建项目。'}已有会话和安排不受影响。</p></header>
    <form onSubmit={event => {
      event.preventDefault(); if (lock.current || loading || !ready) return
      lock.current = true; setBusy(true); setError('')
      void save({ markdown, mode, ...(source?.versionId ? { sourceVersionId: source.versionId } : {}), ...(mode === 'copy' ? { copyAssetId: identity } : {}) })
        .then(result => { if (live.current) onSaved(result.assetId) }, cause => { if (live.current) setError(cause instanceof Error ? cause.message : '保存失败，草稿已保留。') })
        .finally(() => { lock.current = false; if (live.current) setBusy(false) })
    }}>
      <label htmlFor="manual-skill-declaration">技能声明 · SKILL.md</label>
      <p className={css.hint}>description 写适用场景；下方正文写步骤、限制和交付要求。{mode === 'copy' ? '副本标识会自动生成，不覆盖原技能。' : mode === 'edit' ? '保留 name 不变，保存为新的不可变版本。' : 'name 已自动生成，可以保留。'}</p>
      {loading ? <p role="status">正在读取原版本…</p> : <textarea id="manual-skill-declaration" spellCheck={false} value={markdown} disabled={busy} onChange={event => setMarkdown(event.target.value)} />}
      {error && <p className={css.error} role="alert">{error}</p>}
      {source && error && markdown === initial && <button type="button" onClick={() => setReload(value => value + 1)}>重新读取</button>}
      <footer><button type="button" disabled={busy} onClick={close}>取消</button><button type="submit" data-primary disabled={busy || loading || !ready || !markdown.trim()}>{busy ? '正在保存…' : mode === 'edit' ? '保存新版本' : '保存到我的创建'}</button></footer>
    </form>
    {discard && <ActionDialog title="放弃未保存的修改？" onClose={() => setDiscard(false)}><p>修改尚未保存，原技能不会改变。</p><footer><button onClick={() => setDiscard(false)}>继续编辑</button><button data-danger onClick={onClose}>放弃修改</button></footer></ActionDialog>}
  </section>
}
