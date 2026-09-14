/** QuantSkills Gravity Lane model and reasoning-effort selector. */
import { CaretDown, CaretLeft, CaretRight, Check, RocketLaunch } from '@phosphor-icons/react'
import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  useEffect, useId, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties,
} from 'react'
import css from './QuantSkillsGravityLaneModelSelect.module.css'

type GravityLaneState = 'off' | 'low' | 'medium' | 'high' | 'max'

interface EffortChoice {
  readonly key: string
  readonly effort: string | undefined
  readonly label: string
}

type GravityLaneStyle = CSSProperties & {
  readonly '--qs-lane-progress': string
  readonly '--qs-lane-particle-width': string
}

/** Props supplied by the stock model-selection service and composer seat. */
export type QuantSkillsGravityLaneModelSelectProps = PropsRuntime<'conversation.input.model'>
  & InjectFace<ModelSelectInjected>
  & PropsLocale<'model'>

function laneState(index: number, count: number, effort: string | undefined): GravityLaneState {
  const id = effort?.toLocaleLowerCase() ?? ''
  if (id === 'off' || id === 'none' || id.includes('disable')) return 'off'
  if (id === 'low' || id === 'minimal') return 'low'
  if (id === 'medium') return 'medium'
  if (id === 'high') return 'high'
  if (id === 'max' || id === 'xhigh' || id === 'x-high' || id === 'ultra' || id.includes('extreme')) return 'max'
  if (count <= 1 || index <= 0) return 'off'
  const ratio = index / (count - 1)
  return ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'medium' : ratio <= 0.75 ? 'high' : 'max'
}

function laneStyle(index: number, count: number): GravityLaneStyle {
  const progress = count <= 1 ? 0 : index / (count - 1)
  return {
    '--qs-lane-progress': `${7 + progress * 86}%`,
    '--qs-lane-particle-width': `${7 + progress * 86}%`,
  }
}

/**
 * Render the QuantSkills-branded composer model seat and Gravity Lane slider.
 *
 * @param props - Shared model directory, model-selection action, lock state, and locale.
 * @returns The model trigger and its model/effort popover.
 */
export function QuantSkillsGravityLaneModelSelect({
  locked, available, directory, load, select, t,
}: QuantSkillsGravityLaneModelSelectProps): JSX.Element | null {
  const state = useSyncExternalStore(
    callback => directory.subscribe(callback),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<'root' | 'models'>('root')
  const [previewEffortIndex, setPreviewEffortIndex] = useState<number | undefined>()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  const choices = useMemo(() => state.groups.flatMap(group => group.models.map(model => ({
    group,
    model,
    selection: {
      provider: group.id,
      model: model.id,
      ...(model.reasoning?.defaultEffort === undefined
        ? {}
        : { reasoningEffort: model.reasoning.defaultEffort }),
    },
  }))), [state.groups])
  const currentChoice = state.current === null
    ? undefined
    : choices.find(choice => choice.selection.provider === state.current?.provider
      && choice.selection.model === state.current.model)
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortChoices = useMemo<readonly EffortChoice[]>(() => reasoning === undefined
    ? []
    : [
        ...(reasoning.defaultEffort === undefined
          ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
          : []),
        ...reasoning.efforts.map(effort => ({
          key: `effort:${effort.id}`,
          effort: effort.id,
          label: effort.name,
        })),
      ], [reasoning, t])
  const resolvedEffortIndex = Math.max(0, effortChoices.findIndex(choice => choice.effort === effectiveEffort))
  const displayedEffortIndex = Math.min(
    Math.max(previewEffortIndex ?? resolvedEffortIndex, 0),
    Math.max(effortChoices.length - 1, 0),
  )
  const displayedEffort = effortChoices[displayedEffortIndex]
  const visualState = laneState(displayedEffortIndex, effortChoices.length, displayedEffort?.effort)
  const waiting = state.current === null && state.status === 'loading'
  const modelLabel = waiting
    ? t('trigger.loading')
    : currentChoice?.model.name ?? (state.current === null
        ? t('trigger.fallback')
        : `${state.current.provider}/${state.current.model}`)
  const effortLabel = displayedEffort?.label
  const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
  const triggerAria = waiting
    ? t('trigger.loading')
    : state.current === null
      ? t('trigger.selectAria')
      : effortLabel === undefined
        ? t('trigger.aria', { model: modelLabel })
        : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })
  const busy = state.status === 'selecting'

  useEffect(() => {
    setPreviewEffortIndex(undefined)
  }, [effectiveEffort])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => { document.removeEventListener('pointerdown', closeOutside) }
  }, [open])

  if (!available) return null

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setPane('root')
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }
  const show = (): void => {
    setPane('root')
    setOpen(true)
    load()
  }
  const chooseModel = (choice: typeof choices[number]): void => {
    if (state.current?.provider === choice.selection.provider
      && state.current.model === choice.selection.model) {
      close(true)
      return
    }
    void select(choice.selection).then((accepted) => {
      if (accepted) close(true)
    })
  }
  const chooseEffort = (index: number): void => {
    const choice = effortChoices[index]
    if (choice === undefined || state.current === null || choice.effort === effectiveEffort) return
    setPreviewEffortIndex(index)
    const selection = {
      provider: state.current.provider,
      model: state.current.model,
      ...(choice.effort === undefined ? {} : { reasoningEffort: choice.effort }),
    }
    void select(selection).then((accepted) => {
      if (!accepted) setPreviewEffortIndex(undefined)
    })
  }

  return <div
    ref={rootRef}
    className={css.root}
    data-qs-gravity-lane
    data-lane-state={visualState}
    onKeyDown={(event) => {
      if (event.key !== 'Escape' || !open) return
      event.preventDefault()
      if (pane === 'models') setPane('root')
      else close(true)
    }}
  >
    <button
      ref={triggerRef}
      type="button"
      className={css.trigger}
      aria-label={triggerAria}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? `${id}-menu` : undefined}
      title={triggerLabel}
      disabled={locked}
      onClick={() => { if (open) close(); else show() }}
    >
      <span className={css.triggerLabel}>{modelLabel}</span>
      {effortLabel !== undefined && <span className={css.triggerEffort}>{effortLabel}</span>}
      <CaretDown size={14} weight="bold" className={open ? css.chevronOpen : css.chevron}/>
    </button>

    {open && <div
      id={`${id}-menu`}
      className={css.menu}
      role="dialog"
      aria-label={t('menu.aria')}
      aria-busy={state.status === 'loading' || busy}
    >
      {pane === 'root' && <>
        <button type="button" className={css.modelRow} onClick={() => { setPane('models') }}>
          <span>{t('menu.model')}</span>
          <span className={css.modelValue}>{modelLabel}</span>
          <CaretRight size={14}/>
        </button>
        {effortChoices.length === 0
          ? <p className={css.empty}>{t('empty.efforts')}</p>
          : <div className={css.laneSection}>
              <div className={css.laneHeader}>
                <span>{t('menu.effort')}</span>
                <strong>{effortLabel}</strong>
              </div>
              <div className={css.lane} style={laneStyle(displayedEffortIndex, effortChoices.length)}>
                <span className={css.track} aria-hidden="true">
                  <span className={css.particleWindow}>
                    <span className={css.particles}/>
                  </span>
                </span>
                <span className={css.thumb} aria-hidden="true">
                  <span className={css.exhaust}/>
                  <RocketLaunch size={25} weight="fill" className={css.rocket}/>
                </span>
                <input
                  className={css.range}
                  type="range"
                  min={0}
                  max={Math.max(effortChoices.length - 1, 0)}
                  step={1}
                  value={displayedEffortIndex}
                  aria-label={t('menu.effort')}
                  aria-valuetext={effortLabel}
                  disabled={busy}
                  onInput={(event) => { chooseEffort(Number(event.currentTarget.value)) }}
                />
              </div>
              <div className={css.stops}>
                {effortChoices.map((choice, index) => <button
                  type="button"
                  key={choice.key}
                  className={index === displayedEffortIndex ? css.stopActive : css.stop}
                  aria-pressed={index === displayedEffortIndex}
                  disabled={busy}
                  onClick={() => { chooseEffort(index) }}
                >{choice.label}</button>)}
              </div>
            </div>}
      </>}

      {pane === 'models' && <>
        <button type="button" className={css.back} onClick={() => { setPane('root') }}>
          <CaretLeft size={14}/>
          <span>{t('menu.model')}</span>
        </button>
        {state.error !== null && <div className={css.error} role="alert">
          <span>{t('error.action', { message: state.error })}</span>
          <button type="button" onClick={load}>{t('action.reload')}</button>
        </div>}
        <div className={css.groups}>
          {state.groups.length === 0
            ? <p className={css.empty}>{state.status === 'loading' ? t('status.loading') : t('empty.models')}</p>
            : state.groups.map(group => <section key={group.id} className={css.group}>
                <h3>{group.name}</h3>
                {group.models.map(model => {
                  const choice = choices.find(candidate => candidate.group.id === group.id
                    && candidate.model.id === model.id)
                  if (choice === undefined) return null
                  const selected = state.current?.provider === group.id && state.current.model === model.id
                  return <button
                    key={model.id}
                    type="button"
                    className={css.modelOption}
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => { chooseModel(choice) }}
                  >
                    <span>{model.name}</span>
                    {selected && <Check size={16} weight="bold"/>}
                  </button>
                })}
              </section>)}
        </div>
      </>}

      {pane === 'root' && state.error !== null && <div className={css.error} role="alert">
        <span>{t('error.action', { message: state.error })}</span>
      </div>}
    </div>}
  </div>
}
