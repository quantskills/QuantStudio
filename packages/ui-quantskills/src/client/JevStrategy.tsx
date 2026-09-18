import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ContestWatchAction, ContestWatchConfig } from './plugin-types.ts'
import { watchActions } from './ContestWatchVisuals.tsx'
import css from './ContestPage.module.css'

const defaults: Record<ContestWatchAction, string> = { hold: '证据不足、信号不清或维持持仓更合适时观望。', open_long: '空仓且现有证据支持时建议开多。', open_short: '空仓且现有证据支持时建议开空。', close_long: '多头依据失效或已有证据支持退出时建议平多。', close_short: '空头依据失效或已有证据支持退出时建议平空。' }

export function JevStrategy({ config, onChange }: { config: ContestWatchConfig; onChange: Dispatch<SetStateAction<ContestWatchConfig>> }) {
  const [error, setError] = useState('')
  return <div className={css.watchInstructions}>
    <label>策略名称<input maxLength={80} value={config.strategyName ?? '自定义策略'} onChange={event => onChange({ ...config, strategyName: event.target.value })}/></label>
    <label>研究目标和约束<textarea required maxLength={2000} value={config.instructions} onChange={event => onChange({ ...config, instructions: event.target.value })}/></label>
    <details className={css.jevHistory} open={config.customStrategy || undefined}><summary>定制各动作判断标准</summary>
      {Object.entries(watchActions).map(([action, label]) => <label key={action}>{label}标准<textarea required maxLength={1000}
        value={config.actionCriteria?.[action as ContestWatchAction] ?? defaults[action as ContestWatchAction]}
        onChange={event => onChange({ ...config, actionCriteria: { ...config.actionCriteria, [action]: event.target.value } })}/></label>)}
    </details>
    <label>参考资料<textarea maxLength={12000} value={config.referenceMaterial ?? ''} placeholder="粘贴策略说明、带日期的研究记录或退出条件。请写明来源和时间；不会自动读取链接。"
      onChange={event => onChange({ ...config, referenceMaterial: event.target.value })}/></label>
    <label>导入文本资料（.txt / .md，最多 12000 字符）<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; setError('')
      if (!file) return
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 64000) { setError('请选择不超过 64 KB 的 TXT 或 Markdown 文本。'); return }
      void file.text().then(text => {
        if (text.length > 12000 || text.includes('\0')) { setError('资料须为纯文本，且不超过 12000 字符。'); return }
        onChange(current => ({ ...current, referenceMaterial: text }))
      }).catch(() => setError('文件读取失败，请重试。'))
    }}/></label>
    {error && <p className={css.error} role="alert">{error}</p>}
    <p className={css.jevFine}>参考资料会随决策发送给 TypeSafe。历史 K 线来自下方所选数据源；不会自动抓取参考文本中的链接或新闻。模型固定为 jev-1.13.0；当前 API 未提供 temperature、top_p 或训练参数。</p>
  </div>
}
