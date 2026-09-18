import { useEffect, useState } from 'react'
import { PlusIcon, ArrowLeftIcon, XIcon } from '@phosphor-icons/react'
import type { ModelAccessRequest, ModelAccessResponse, ModelConnection, ModelConnectionDraft, ModelServiceDefinition } from '@deepseek-ai/dsh-quantskills-session/types'
import css from './QuantSkillsModelServices.module.css'

export type ModelAccess = (request: ModelAccessRequest) => Promise<ModelAccessResponse>
const stateLabel: Record<string, string> = { saved: '已保存 · 待验证', verified: '验证通过', failed: '验证失败', 'discovery-unavailable': '已保存 · 需推理验证' }

const MODEL_ID_TEMPLATE = ['your-model-id', 'your-model-id-fast']

type CapabilityProfile = { id: string; input?: string[]; reasoningEfforts?: false | Record<string, string | null>; compat?: Record<string, unknown> }
function parseCapabilityProfiles(raw: string | undefined, ids: readonly string[]): CapabilityProfile[] {
  try {
    const parsed = raw ? JSON.parse(raw) : []
    if (raw && Array.isArray(parsed)) return parsed.filter(item => item && typeof item.id === 'string')
  } catch { /* keep the guided editor usable while JSON is being edited */ }
  return ids.map(id => ({ id: id.trim(), input: ['text'] })).filter(item => item.id)
}
function profileReasoning(profile: CapabilityProfile): 'unsupported' | 'supported' | 'unknown' {
  if (profile.reasoningEfforts === false) return 'unsupported'
  if (profile.reasoningEfforts && typeof profile.reasoningEfforts === 'object') return 'supported'
  return 'unknown'
}

function capabilityTemplate(modelIds: readonly string[], api: string): string {
  const profiles = modelIds.map(id => ({
    id,
    input: ['text'],
    reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high' },
    ...(api === 'openai-completions'
      ? { compat: { supportsReasoningEffort: true } }
      : api === 'anthropic-messages'
        ? { compat: { forceAdaptiveThinking: true } }
        : {}),
  }))
  return JSON.stringify(profiles, null, 2)
}
/** QuantSkills owns this form and its typed Host API; no hidden Host forms are mounted. */
export function QuantSkillsModelServices({ access, initialData, initialAdding = false, onSaved, onBusyChange }: {
  access?: ModelAccess | undefined
  initialData?: ModelAccessResponse | undefined
  initialAdding?: boolean
  onSaved?: (result: ModelAccessResponse) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [data, setData] = useState<ModelAccessResponse | undefined>(initialData)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState(initialAdding)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<ModelConnectionDraft>()
  const [advancedModels, setAdvancedModels] = useState<string>()
  const [deleteRoute, setDeleteRoute] = useState<string>()
  const [testing, setTesting] = useState<ModelConnection>()
  const [testModel, setTestModel] = useState('')
  const currentProfiles = parseCapabilityProfiles(advancedModels ?? data?.connections.find(c => c.route === draft?.route)?.modelsJson, draft?.modelIds ?? [])
  const updateProfile = (id: string, status: 'unknown' | 'supported' | 'unsupported') => {
    const profiles = currentProfiles.map(profile => {
      if (profile.id !== id) return profile
      const next = { ...profile }
      if (status === 'unknown') delete next.reasoningEfforts
      else if (status === 'unsupported') next.reasoningEfforts = false
      else if (next.reasoningEfforts === undefined || next.reasoningEfforts === false) next.reasoningEfforts = { low: 'low' }
      next.compat = { ...(next.compat ?? {}) }
      if (draft?.api === 'openai-completions') {
        if (status === 'unknown') delete next.compat.supportsReasoningEffort
        else next.compat.supportsReasoningEffort = status === 'supported'
      }
      return next
    })
    setAdvancedModels(JSON.stringify(profiles, null, 2))
  }
  useEffect(() => {
    let active = true
    if (access && !initialData) void Promise.resolve().then(() => access({ action: 'list' })).then(result => { if (active) setData(result) },
      () => { if (active) setError('无法读取模型服务，请检查 Host 连接。') })
    return () => { active = false }
  }, [access, initialData])
  const run = async (request: ModelAccessRequest) => {
    if (!access || busy) return
    if (request.draft) request = { ...request, draft: { ...request.draft, modelIds: request.draft.modelIds.map(id => id.trim()).filter(Boolean) } }
    setBusy(true); onBusyChange?.(true); setError(''); setMessage('')
    try {
      const result = await access(request)
      setData(result)
      setMessage(result.verification?.message ?? '操作已保存。')
      if (request.action === 'verify' && result.verification?.state === 'verified') {
        setDraft(current => current ? { ...current, modelIds: result.verification!.modelIds } : current)
        if (result.verification.modelProfiles) setAdvancedModels(JSON.stringify(result.verification.modelProfiles, null, 2))
      }
      if (request.action === 'save') { setDraft(undefined); setAdding(false); setAdvancedModels(undefined); onSaved?.(result) }
      if (request.action === 'remove') setDeleteRoute(undefined)
      if (request.action === 'test') setTesting(undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试。') }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  const choose = (service: ModelServiceDefinition) => {
    setDraft({ service: service.id, name: service.name, baseURL: service.variants[0]?.baseURL ?? '', api: service.api, modelIds: [], auto: false })
    setAdvancedModels(undefined); setError(''); setMessage('')
  }
  const edit = (connection: ModelConnection) => {
    setAdding(true)
    setDraft({ route: connection.route, service: connection.service, name: connection.name, baseURL: connection.baseURL, api: connection.api, modelIds: connection.modelIds, auto: connection.auto, ...connection.reasoning === undefined ? {} : { reasoning: connection.reasoning } })
    setAdvancedModels(undefined); setError(''); setMessage('')
  }
  const service = data?.catalog.find(item => item.id === draft?.service)
  const local = draft?.service === 'codex-local'
  return <div className={css.root}>
    <header><div><small>MODEL SERVICES</small><h2>模型服务</h2><p>接入后即可开始任务。保存后可在会话模型选择器中选择具体模型。</p></div>
      {!adding && <button type="button" disabled={!data || busy} onClick={() => { setAdding(true); setSearch(''); setError(''); setMessage('') }}><PlusIcon/>添加模型服务</button>}
    </header>
    {error && <p role="alert" className={css.error}>{error}</p>}
    {message && <p role="status">{message}</p>}
    {!access && <p role="alert">模型接入服务暂不可用，请重新连接 Host。</p>}
    {access && !data && !error && <p role="status">正在读取已保存的服务…</p>}
    {adding && <section className={css.editor} aria-label="添加或管理模型服务">
      <header><button type="button" disabled={busy} aria-label="返回服务选择" onClick={() => { setDraft(undefined); setAdvancedModels(undefined) }}><ArrowLeftIcon/></button>
        <h3>{draft ? draft.name : '选择模型服务'}</h3>
        <button type="button" disabled={busy} aria-label="关闭模型服务表单" onClick={() => { setAdding(false); setDraft(undefined); setAdvancedModels(undefined) }}><XIcon/></button></header>
      {!draft ? <>
        <input aria-label="搜索模型服务" placeholder="搜索厂商或自定义服务" value={search} onChange={event => { setSearch(event.target.value) }}/>
        <div className={css.catalog}>{data?.catalog.filter(item => (item.name + item.id + (item.recommendations?.map(model => model.name).join(' ') ?? '')).toLowerCase().includes(search.toLowerCase())).map(item =>
          <button type="button" key={item.id} onClick={() => { choose(item) }}><b>{item.name}</b><small>{item.id === 'codex-local' ? '使用本机登录' : item.id === 'custom' ? '兼容网关或本地服务' : `预置支持 · ${item.recommendations?.length ?? 0} 个目录推荐 · 需要自行授权`}</small></button>)}</div>
      </> : <form onSubmit={event => { event.preventDefault(); void run({ action: 'save', draft: { ...draft, ...(advancedModels === undefined ? {} : { modelsJson: advancedModels }) } }) }}>
        <fieldset disabled={busy}>
          {local ? <p>检查本机 Codex 安装、登录状态及可用模型；不要求 API 密钥，不修改全局 Codex 配置。</p> : <>
            {(service?.variants.length ?? 0) > 1 && <label>服务区域 / 套餐
              <select value={service?.variants.find(v => v.baseURL === draft.baseURL)?.id ?? ''} onChange={event => {
                const variant = service?.variants.find(v => v.id === event.target.value)
                if (variant) setDraft({ ...draft, baseURL: variant.baseURL, apiKey: '' })
              }}><option value="" disabled>自定义地址（高级设置）</option>{service?.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
            </label>}
            {draft.service === 'custom' && <label>服务地址<input required type="url" value={draft.baseURL} placeholder="https://example.com/v1" onChange={event => { setDraft({ ...draft, baseURL: event.target.value }) }}/></label>}
            {/^http:/i.test(draft.baseURL.trim()) && <small>HTTP 会明文传输 API 密钥和请求内容；请确认网络可信，公网服务建议使用 HTTPS。</small>}
            <label>API 密钥<input type="password" autoComplete="new-password" value={draft.apiKey ?? ''} placeholder={draft.route ? '已保存的密钥不回显；输入新值才替换' : draft.service === 'custom' ? '本机无鉴权服务可留空' : '填写厂商提供的 API 密钥'}
              onChange={event => { setDraft({ ...draft, apiKey: event.target.value }) }}/></label>
          </>}
          {!!service?.recommendations?.length && <section className={css.recommendations} aria-label="目录推荐模型">
            <header><div><b>目录推荐</b><small>仅供选型参考，不会自动加入可运行模型</small></div></header>
            <div>{service.recommendations.map(model => <article key={model.name}>
              <div><strong>{model.name}</strong>{model.lifecycle === 'experimental' && <small>实验</small>}{!model.exactId && <small>系列名</small>}</div>
              <p>{model.summary}</p>
              <small>{model.roles.join(' · ')}</small>
            </article>)}</div>
            <p>连接验证后可获取可用模型；推理测试可以进一步确认模型是否能够正常响应。</p>
          </section>}
          {!local && <label>默认思考强度
            <select aria-label="默认思考强度" value={draft.reasoning ?? ''} onChange={event => { const value = event.target.value; setDraft({ ...draft, ...(value ? { reasoning: value } : { reasoning: undefined }) }) }}>
              <option value="">自动（按模型能力）</option><option value="off">关闭</option><option value="minimal">最小</option>
              <option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="xhigh">很高</option><option value="max">最大</option>
            </select>
            <small>这是服务路由的默认值；仅选择模型能力中确实声明支持的强度。留空由模型自身默认值决定。</small>
          </label>}
          <div className={css.actions}><button type="button" onClick={() => { void run({ action: 'verify', draft }) }}>{local ? '检查安装与登录' : '验证连接并获取模型'}</button></div>
          {!local && <div className={css.fieldBlock}>
            <div className={css.fieldHeader}><label htmlFor="qs-model-ids">模型 ID（每行一个；无法发现时可手动补充）</label><button type="button" onClick={() => {
              setAdvancedModels(undefined)
              setDraft({ ...draft, modelIds: [...MODEL_ID_TEMPLATE] })
            }}>填入 ID 模板</button></div>
            <textarea id="qs-model-ids" rows={Math.min(6, Math.max(2, draft.modelIds.length))} value={draft.modelIds.join('\n')}
              placeholder={'your-model-id\nyour-model-id-fast'}
              onChange={event => { setAdvancedModels(undefined); setDraft({ ...draft, modelIds: event.target.value.split('\n') }) }}/>
            <small>请替换为厂商控制台或模型目录返回的精确 ID；模板内容不能直接用于真实调用。</small>
          </div>}
          {!local && draft.modelIds.length > 0 && <section className={css.fieldBlock} aria-label="模型能力配置">
            <div className={css.fieldHeader}><label>模型能力配置</label><small>无需填写 JSON，可直接选择</small></div>
            <p>连接验证后，系统会自动带入模型。无法确定的项目保持“自动检测”，保存后可用“推理测试”确认。</p>
            <div className={css.capabilityTable}>
              {currentProfiles.map(profile => { const status = profileReasoning(profile)
                return <div className={css.capabilityRow} key={profile.id}>
                  <strong>{profile.id}</strong>
                  <label>思考能力<select aria-label={`${profile.id} 思考能力`} value={status} onChange={event => { const value = event.target.value; updateProfile(profile.id, value as 'unknown' | 'supported' | 'unsupported') }}><option value="unknown">自动检测</option><option value="supported">支持思考</option><option value="unsupported">不支持</option></select></label>
                </div> })}
            </div>
          </section>}
          {!local && <details><summary>高级设置</summary>
            <label>显示名称<input value={draft.name} onChange={event => { setDraft({ ...draft, name: event.target.value }) }}/></label>
            {draft.service !== 'custom' && <label>服务地址<input type="url" value={draft.baseURL} onChange={event => { setDraft({ ...draft, baseURL: event.target.value }) }}/></label>}
            <label>API 协议<select value={draft.api} onChange={event => { setDraft({ ...draft, api: event.target.value }) }}>
              <option value="openai-completions">OpenAI Chat Completions 兼容</option><option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic-messages">Anthropic Messages</option><option value="google-generative-ai">Google Generative AI</option>
            </select></label>
            <div className={css.fieldBlock}>
              <div className={css.fieldHeader}><label htmlFor="qs-model-capabilities">模型能力覆盖（JSON；未编辑则保留现有配置）</label><button type="button" onClick={() => {
                const ids = draft.modelIds.map(id => id.trim()).filter(Boolean)
                if (ids.length === 0) { setError('请先填写至少一个模型 ID，再生成能力模板。'); return }
                setError('')
                setAdvancedModels(capabilityTemplate(ids, draft.api))
              }}>按模型 ID 生成模板</button></div>
              <textarea id="qs-model-capabilities" rows={10}
                value={advancedModels ?? data?.connections.find(c => c.route === draft.route)?.modelsJson ?? JSON.stringify(draft.modelIds.filter(id => id.trim()).map(id => ({ id: id.trim() })), null, 2)}
                placeholder={capabilityTemplate(['your-model-id'], draft.api)}
                onChange={event => { setAdvancedModels(event.target.value) }}/>
              <div className={css.templateHelp}>
                <strong>关键参数怎么填</strong>
                <p><code>input</code> 填 <code>["text"]</code>；厂商确认支持图片时改为 <code>["text", "image"]</code>。</p>
                <p><code>reasoningEfforts: false</code> 表示不支持思考；对象表示支持思考开关与强度。键使用 <code>off / low / medium / high</code>，值必须改成厂商 API 实际接收的拼写。</p>
                <p><code>off: null</code> 表示关闭时不发送思考强度。OpenAI Chat Completions 兼容服务只有在确认支持 <code>reasoning_effort</code> 后，才保留 <code>supportsReasoningEffort: true</code>。</p>
              </div>
            </div>
            <p>只填写厂商已确认支持的能力。更换地址或协议需重新输入密钥，旧密钥不会被发往新地址。</p>
          </details>}
          {service?.docs && <p><a href={service.docs} target="_blank" rel="noreferrer">厂商官方接入说明</a> · 预置适配不代表已完成实账号验收。</p>}
          <button type="submit">{busy ? '处理中…' : '验证并保存'}</button>
        </fieldset>
      </form>}
    </section>}
    {!adding && data && <div className={css.connections}>
      {data.connections.length === 0 && <p>尚未添加模型服务。选择厂商并填写密钥即可开始。</p>}
      {data.connections.map(connection => <section key={connection.route} aria-label={connection.name}>
        <header><div><h3>{connection.name}</h3><small>{stateLabel[connection.state] ?? '待验证'} · {connection.modelIds.length} 个已配置模型</small></div>
          <button type="button" disabled={busy} onClick={() => { edit(connection) }}>管理</button></header>
        <p>{connection.message}</p>
        <div className={css.actions}>
          <button type="button" disabled={busy} onClick={() => { void run({ action: 'verify', draft: { route: connection.route, service: connection.service, name: connection.name,
            baseURL: connection.baseURL, api: connection.api, auto: connection.auto, modelIds: connection.modelIds, ...connection.reasoning === undefined ? {} : { reasoning: connection.reasoning } } }) }}>检查连接</button>
          <button type="button" disabled={busy || !connection.modelIds.length} onClick={() => { setTesting(connection); setTestModel(connection.modelIds[0] ?? '') }}>推理测试</button>
          {connection.service !== 'codex-local' && <button type="button" disabled={busy} onClick={() => { setDeleteRoute(connection.route) }}>移除连接</button>}
        </div>
        {deleteRoute === connection.route && <div role="alert"><p>将移除 {connection.name} 的 {connection.modelIds.length} 个模型。现有会话的模型引用不会静默替换，共用凭据仍保留。</p>
          <button type="button" disabled={busy} onClick={() => { void run({ action: 'remove', route: connection.route }) }}>确认移除</button>
          <button type="button" disabled={busy} onClick={() => { setDeleteRoute(undefined) }}>取消</button></div>}
      </section>)}
    </div>}
    {testing && <section className={css.editor} aria-label="确认推理测试"><h3>测试 {testing.name}</h3>
      <p>将发送固定测试文本，不含会话或工作区内容。可能消耗 API 额度或订阅用量。</p>
      <select aria-label="测试模型" value={testModel} onChange={event => { setTestModel(event.target.value) }}>{testing.modelIds.map(id => <option key={id}>{id}</option>)}</select>
      <div className={css.actions}><button type="button" disabled={busy} onClick={() => { void run({ action: 'test', route: testing.route, model: testModel }) }}>开始真实推理测试</button>
        <button type="button" disabled={busy} onClick={() => { setTesting(undefined) }}>取消</button></div></section>}
  </div>
}
