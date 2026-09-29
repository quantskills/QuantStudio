import './TradingWorkspace.css'

export function TradingSettingsNavigation<T extends string | number>({ current, items, onChange }: {
  current: T; items: readonly { id: T; title: string; detail: string }[]; onChange(value: T): void
}) {
  return <nav className="qs-settings-navigation" aria-label="设置栏目">{items.map(item =>
    <button type="button" key={item.id} aria-label={item.title} aria-current={current === item.id ? 'page' : undefined} onClick={() => onChange(item.id)}>
      <strong>{item.title}</strong><small>{item.detail}</small>
    </button>)}</nav>
}
