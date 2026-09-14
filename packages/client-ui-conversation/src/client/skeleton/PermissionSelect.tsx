import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { EyeIcon, KeyIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import type { PermissionSelect as PermissionSelectValue } from '@deepseek-ai/dsh-permission-presets/client'
import { IconChevronDownOutline14, Menu, RiskConfirmation } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ComposerBarProps } from '../contract/slots.ts'
import { en } from '../locales.ts'
import css from './PermissionSelect.module.css'

const FULL_ACCESS = 'danger-full-access'

/** Distinct, familiar silhouettes make the three access scopes easy to scan. */
const permissionGlyphs = new Map<string, ReactNode>([
  ['read-only', (
    <span className={clsx(css.modeIcon, css.readOnlyIcon)} aria-hidden>
      <EyeIcon size={20} weight="duotone" />
    </span>
  )],
  ['workspace-write', (
    <span className={clsx(css.modeIcon, css.limitedIcon)} aria-hidden>
      <ShieldCheckIcon size={20} weight="duotone" />
    </span>
  )],
  [FULL_ACCESS, (
    <span className={clsx(css.modeIcon, css.fullAccessIcon)} aria-hidden>
      <KeyIcon size={20} weight="duotone" />
    </span>
  )],
])
/** Glyph for a permission option value; host-configured names outside the design set get none. */
function permissionGlyph(value: string): ReactNode | undefined {
  return permissionGlyphs.get(value)
}

/**
 * Display transform: built-in machine names render as locale product labels;
 * non-kebab host-configured names pass through.
 */
function displayName(name: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const BUILT_IN_PERMISSION_NAMES = new Map<string, string>([
  ['read-only', en['access.preset.readOnly']],
  ['workspace-write', en['access.preset.workspaceWrite']],
  [FULL_ACCESS, en['access.preset.fullAccess']],
])

function permissionLabel(
  value: string,
  name: string,
  t: ComposerBarProps['t'],
): string {
  const builtInName = BUILT_IN_PERMISSION_NAMES.get(value)
  if (builtInName !== undefined && (name === value || name === builtInName)) {
    if (value === 'read-only') return t('access.preset.readOnly')
    if (value === 'workspace-write') return t('access.preset.workspaceWrite')
    if (value === FULL_ACCESS) return t('access.preset.fullAccess')
  }
  return displayName(name)
}

export interface PermissionSelectProps {
  value: PermissionSelectValue | undefined
  locked: boolean
  command: (line: string) => Promise<boolean>
  /** The owning bar's locale seat, passed down as a plain prop. */
  t: ComposerBarProps['t']
}

export function PermissionSelect({ value, locked, command, t }: PermissionSelectProps) {
  const [pick, setPick] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (!locked && value !== undefined) return
    setOpen(false)
    setAcknowledged(false)
    setConfirmation(null)
  }, [locked, value])

  if (value === undefined) return null

  const currentValue = pick ?? value.currentValue
  const current = value.options.find(option => option.value === currentValue)
  const currentLabel = current === undefined
    ? permissionLabel(currentValue, currentValue, t)
    : permissionLabel(current.value, current.name, t)
  const busy = pick !== null || confirmation !== null

  const items: MenuEntry[] = value.options
    .filter(o => o.value !== 'custom')
    .map((option) => {
      const icon = permissionGlyph(option.value)
      return {
        id: option.value,
        label: permissionLabel(option.value, option.name, t),
        ...icon === undefined ? {} : { icon },
      }
    })

  const submit = (id: string): void => {
    setPick(id)
    void command(`/permission ${id}`)
      .catch(() => false)
      .then(() => { setPick(null) })
  }

  const choose = (id: string): void => {
    setOpen(false)
    if (id === value.currentValue) return
    if (id === FULL_ACCESS) {
      setAcknowledged(false)
      setConfirmation(id)
      return
    }
    submit(id)
  }

  const closeConfirmation = (): void => {
    setAcknowledged(false)
    setConfirmation(null)
  }

  const confirmFullAccess = (): void => {
    if (locked || !acknowledged || confirmation === null) return
    const id = confirmation
    closeConfirmation()
    submit(id)
  }

  return (
    <>
      <Menu
        open={open}
        items={items}
        selectedId={currentValue}
        onSelect={choose}
        onClose={() => { setOpen(false) }}
        side="top"
        anchor={
          <button
            type="button"
            className={css.trigger}
            aria-label={t('input.accessMode', { name: currentLabel })}
            title={current?.description}
            disabled={locked || busy}
            onClick={() => { setOpen(!open) }}
          >
            {permissionGlyph(currentValue) !== undefined && (
              <span className={css.triggerIcon} aria-hidden>{permissionGlyph(currentValue)}</span>
            )}
            <span className={css.triggerLabel}>{currentLabel}</span>
            <span className={clsx(css.chevron, open && css.chevronOpen)} aria-hidden>
              <IconChevronDownOutline14 />
            </span>
          </button>
        }
      />
      <RiskConfirmation
        open={confirmation !== null}
        title={t('access.confirm.title')}
        description={t('access.confirm.description')}
        acknowledgeLabel={t('access.confirm.acknowledge')}
        cancelLabel={t('access.confirm.cancel')}
        closeLabel={t('close')}
        confirmLabel={t('access.confirm.enable')}
        acknowledged={acknowledged}
        disabled={locked}
        onAcknowledgedChange={setAcknowledged}
        onCancel={closeConfirmation}
        onConfirm={confirmFullAccess}
      />
    </>
  )
}
