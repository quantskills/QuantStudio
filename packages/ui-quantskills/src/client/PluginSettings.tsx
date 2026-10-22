import { useState } from 'react'
import css from './QuantSkillsApp.module.css'

/** Keep the native manager's slots and state owned by its registered main panel. */
export function PluginSettings({ openManager }: {
  openManager?: (() => void) | undefined
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
      <p>社区插件在插件管理的「发现」中浏览，安装、更新和卸载统一由插件管理器处理。</p>
      <p>首次使用时，在「官方扩展」启用「插件市场」。已有社区插件的来源与配置会保留。</p>
    </section>
  </section>
}
