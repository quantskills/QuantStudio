// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import {
  QuantSkillsGravityLaneModelSelect,
  type QuantSkillsGravityLaneModelSelectProps,
} from '../src/client/QuantSkillsGravityLaneModelSelect.tsx'

const copy: Record<string, string> = {
  'trigger.fallback': '选择模型',
  'trigger.loading': '正在加载模型…',
  'trigger.selectAria': '选择模型',
  'trigger.aria': '选择模型，当前 {model}',
  'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'menu.aria': '模型与推理强度',
  'menu.model': '模型',
  'menu.effort': '推理强度',
  'effort.providerDefault': '默认',
  'status.loading': '正在刷新模型列表…',
  'error.action': '模型操作失败：{message}',
  'action.reload': '重新加载',
  'empty.models': '没有可用的模型。',
  'empty.efforts': '当前模型未提供推理等级。',
}

const t = ((key: string, params: Record<string, unknown> = {}) => Object.entries(params)
  .reduce((value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)), copy[key] ?? key)) as QuantSkillsGravityLaneModelSelectProps['t']

function directoryState(reasoningEffort = 'off'): ModelDirectoryState {
  return {
    current: { provider: 'deepseek', model: 'v4-flash', reasoningEffort },
    routable: true,
    groups: [{
      id: 'deepseek',
      name: 'DeepSeek',
      models: [{
        id: 'v4-flash',
        name: 'DeepSeek V4 Flash',
        reasoning: {
          defaultEffort: 'high',
          efforts: [
            { id: 'off', name: '关闭' },
            { id: 'low', name: '低' },
            { id: 'high', name: '强' },
            { id: 'max', name: '极强' },
          ],
        },
      }, {
        id: 'v4-pro',
        name: 'DeepSeek V4 Pro',
        reasoning: {
          defaultEffort: 'high',
          efforts: [
            { id: 'off', name: '关闭' },
            { id: 'low', name: '低' },
            { id: 'high', name: '强' },
            { id: 'max', name: '极强' },
          ],
        },
      }],
    }],
    failures: [],
    status: 'ready',
    error: null,
  }
}

afterEach(() => { cleanup() })

describe('QuantSkillsGravityLaneModelSelect', () => {
  it('maps the four reasoning efforts to the selected visual state and durable selection action', async () => {
    const directory = createSnapshotStore(directoryState())
    const load = vi.fn()
    const select = vi.fn(async (selection: NonNullable<ModelDirectoryState['current']>) => {
      act(() => {
        directory.update(current => ({ ...current, current: selection, status: 'ready', error: null }))
      })
      return true
    })

    const mounted = render(<QuantSkillsGravityLaneModelSelect
      locked={false}
      available
      directory={directory}
      load={load}
      select={select}
      t={t}
    />)

    expect(mounted.container.querySelector('[data-qs-gravity-lane]')?.getAttribute('data-lane-state')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: /选择模型，当前 DeepSeek V4 Flash/ }))
    expect(load).toHaveBeenCalledOnce()

    const slider = screen.getByRole('slider', { name: '推理强度' })
    expect((slider as HTMLInputElement).value).toBe('0')
    expect(slider.getAttribute('aria-valuetext')).toBe('关闭')
    fireEvent.input(slider, { target: { value: '2' } })

    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({
        provider: 'deepseek', model: 'v4-flash', reasoningEffort: 'high',
      })
      expect(mounted.container.querySelector('[data-qs-gravity-lane]')?.getAttribute('data-lane-state')).toBe('high')
      expect(screen.getByRole('slider', { name: '推理强度' }).getAttribute('aria-valuetext')).toBe('强')
    })
  })

  it('keeps model selection available behind the model row', async () => {
    const directory = createSnapshotStore(directoryState('high'))
    const select = vi.fn(async (selection: NonNullable<ModelDirectoryState['current']>) => {
      act(() => { directory.update(current => ({ ...current, current: selection })) })
      return true
    })

    render(<QuantSkillsGravityLaneModelSelect
      locked={false}
      available
      directory={directory}
      load={() => {}}
      select={select}
      t={t}
    />)
    fireEvent.click(screen.getByRole('button', { name: /选择模型，当前 DeepSeek V4 Flash/ }))
    const dialog = screen.getByRole('dialog', { name: '模型与推理强度' })
    fireEvent.click(within(dialog).getByRole('button', { name: /模型.*DeepSeek V4 Flash/ }))
    fireEvent.click(screen.getByRole('button', { name: 'DeepSeek V4 Pro' }))

    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({
        provider: 'deepseek', model: 'v4-pro', reasoningEffort: 'high',
      })
      expect(screen.queryByRole('dialog', { name: '模型与推理强度' })).toBeNull()
    })
  })

  it('keeps medium distinct from high, supports extended effort values, and rolls back a rejected selection', async () => {
    const initial = directoryState('medium')
    const directory = createSnapshotStore({
      ...initial,
      groups: initial.groups.map(group => ({
        ...group,
        models: group.models.map(model => ({
          ...model,
          reasoning: {
            defaultEffort: 'medium',
            efforts: ['off', 'low', 'medium', 'high', 'xhigh', 'max'].map(id => ({ id, name: id })),
          },
        })),
      })),
    })
    let acceptSelection: ((accepted: boolean) => void) | undefined
    const select = vi.fn(() => new Promise<boolean>(resolve => { acceptSelection = resolve }))
    const mounted = render(<QuantSkillsGravityLaneModelSelect
      locked={false}
      available
      directory={directory}
      load={() => {}}
      select={select}
      t={t}
    />)
    const root = mounted.container.querySelector('[data-qs-gravity-lane]')
    const trigger = screen.getByRole('button', { name: /选择模型，当前 DeepSeek V4 Flash/ })
    expect(trigger.querySelector('img')).toBeNull()
    expect(root?.getAttribute('data-lane-state')).toBe('medium')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'xhigh', exact: true }))
    expect(select).toHaveBeenCalledWith({
      provider: 'deepseek', model: 'v4-flash', reasoningEffort: 'xhigh',
    })
    expect(root?.getAttribute('data-lane-state')).toBe('max')
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('xhigh')
    await act(async () => { acceptSelection?.(false) })
    expect(root?.getAttribute('data-lane-state')).toBe('medium')
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('medium')
  })

  it('does not render a selectable control for unavailable subagent sessions', () => {
    const directory = createSnapshotStore(directoryState())
    const mounted = render(<QuantSkillsGravityLaneModelSelect
      locked={false}
      available={false}
      directory={directory}
      load={() => {}}
      select={async () => false}
      t={t}
    />)
    expect(mounted.container.innerHTML).toBe('')
  })
})
