import { useState, type ReactNode } from 'react'
import css from './QuantSkillsApp.module.css'

/** Keep the native manager's slots and state owned by its registered main panel. */
export function PluginSettings({ openManager, community }: {
  openManager?: (() => void) | undefined
  community?: ReactNode
}) {
  const [error, setError] = useState<string>()
  return <section className={css.pluginSettings}>
    <header>
      <h2>插件管理</h2>
      <p>查看已安装插件、官方扩展和运行配置。</p>
      <button type="button" className={css.primaryButton} disabled={!openManager} onClick={() => {
        try { openManager?.(); setError(undefined) }
        catch { setError('暂时无法打开插件管理，请刷新页面后重试。') }
      }}>打开插件管理</button>
      {!openManager && <p role="status">插件管理暂不可用，请检查连接后刷新页面。</p>}
      {error && <p role="alert">{error}</p>}
    </header>
    <section aria-label="社区市场">
      <h3>社区市场</h3>
      {community ?? <p role="status">社区市场暂不可用。已安装的插件与配置保持不变。</p>}
    </section>
  </section>
}
