import { THEME_ICON_FAMILIES, useThemeIconFamily, type ThemeIconFamily } from './theme-icons.ts'
import css from './QuantSkillsApp.module.css'

/** Friendly, distinct library identities using the shared Phosphor icon family. */
export function CapabilityIcon({ kind, size = 24, family, bare = false }: { kind: 'skill' | 'agent' | 'agent-team'; size?: number; family?: ThemeIconFamily; bare?: boolean }) {
  const currentFamily = useThemeIconFamily()
  const selected = family ?? currentFamily
  const Icon = THEME_ICON_FAMILIES[selected][kind === 'skill' ? 0 : kind === 'agent' ? 1 : 2]
  return <span className={css.capabilityIcon} data-kind={kind} data-family={selected} data-bare={bare || undefined} aria-hidden="true"><Icon size={size} weight="regular"/></span>
}
