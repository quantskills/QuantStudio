import { useEffect, useState } from 'react'
import type { ContestJevSettings } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import css from './ContestPage.module.css'

export function JevConnection({ access, disabled, onConfigured, onBusy }: {
  access: NonNullable<ContestAccess['watch']>; disabled: boolean
  onConfigured: (configured: boolean) => void; onBusy: (busy: boolean) => void
}) {
  const [settings, setSettings] = useState<ContestJevSettings>(), [key, setKey] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [translation, setTranslation] = useState('')
  useEffect(() => {
    let disposed = false
    void waitForCompetition(() => access.settings(), 'Jev 配置').then(value => {
      if (!disposed) { setSettings(value); setTranslation(value.translator ? JSON.stringify(value.translator) : ''); onConfigured(value.configured) }
    }).catch(failure => { if (!disposed) setError(failure instanceof Error ? failure.message : '配置读取失败，请重新进入页面。') })
    return () => { disposed = true }
  }, [access, onConfigured])
  const test = async (save: boolean) => {
    if (busy || disabled) return
    setBusy(true); onBusy(true); setError('')
    const candidate = key.trim(); setKey('')
    try {
      const value = await waitForCompetition(() => access.configure(save ? { apiKey: candidate } : {}), 'Jev 连接测试', 45000)
      setSettings(value); onConfigured(value.configured)
    } catch (failure) { setError(failure instanceof Error ? failure.message : '连接测试失败，请重试。') }
    finally { setBusy(false); onBusy(false) }
  }
  return <details className={css.jevConnection} open={settings ? !settings.configured : true}>
    <summary><span>Jev 连接配置</span><span className={css.jevBadge} data-ready={settings?.configured}>{settings?.configured ? '密钥已配置' : '等待配置'}</span></summary>
    <div className={css.jevConnectionBody}>
      <p>在 <a href="https://docs.typesafe.ai/introduction" target="_blank" rel="noreferrer">TypeSafe</a> 获取自己的 API Key，测试成功后保存。每位用户在自己的电脑上完成配置。</p>
      <form className={css.jevKeyForm} onSubmit={event => { event.preventDefault(); void test(true) }}>
        <label>Jev API Key<input type="password" autoComplete="new-password" spellCheck={false} required maxLength={4096} value={key}
          disabled={disabled || busy || settings?.writable === false} placeholder={settings?.configured ? '输入新密钥以替换，已保存密钥不回显' : '粘贴 TypeSafe API Key'}
          onChange={event => setKey(event.target.value)}/></label>
        <button type="submit" data-primary disabled={disabled || busy || !settings?.writable || !key.trim()}>{busy ? '正在测试连接…' : '测试并保存密钥'}</button>
        <button type="button" disabled={disabled || busy || !settings?.configured} onClick={() => { void test(false) }}>测试已保存连接</button>
      </form>
      <div className={css.jevKeyForm}>
        <label>中文专用翻译模型<select value={translation} disabled={disabled || busy} onChange={event => setTranslation(event.target.value)}>
          <option value="">请选择已验证的模型</option>
          {(settings?.translationModels ?? []).map(item => <option key={JSON.stringify(item)} value={JSON.stringify(item)}>{item.model} · {item.provider}</option>)}
        </select></label>
        <button type="button" disabled={disabled || busy || !translation} onClick={async () => {
          setBusy(true); onBusy(true); setError('')
          try { setSettings(await access.configure({ translator: JSON.parse(translation) })) }
          catch (failure) { setError(failure instanceof Error ? failure.message : '翻译配置保存失败。') }
          finally { setBusy(false); onBusy(false) }
        }}>保存翻译模型</button>
      </div>
      <p className={css.jevFine}>内置模板使用预置英文。自定义中文及参考资料经所选模型翻译后交给 Jev，原文保留；相同内容复用翻译。翻译产生独立用量，不修改 Auto 设置。模型列表为空时，请先在模型服务中添加并验证连接。</p>
      {settings?.writable === false && <p>当前凭据只读；请在配置该密钥的环境变量中修改。</p>}
      <p className={css.jevFine}>密钥保存在本机凭据库。连接测试会发起一次小型 Jev 请求，不发送比赛账户或行情。运行盯盘前先连接比赛账户。</p>
      {settings?.message && <p aria-live="polite">{settings.message}{settings.latencyMs !== undefined ? ` · ${settings.latencyMs} ms` : ''}</p>}
      {error && <p className={css.error} role="alert">{error}</p>}
    </div>
  </details>
}
