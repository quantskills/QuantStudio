// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as store from '@deepseek-ai/dsh-client-store'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)

/** Exercise the actual Web bundle rather than the removed QS copy. */
function fixture(locked = false, customName?: string) {
  const modules: Record<string, unknown> = { react: React, 'react/jsx-runtime': jsx,
    '@deepseek-ai/dsh-client-store': store, '@deepseek-ai/dsh-client-ui-primitives': primitives }
  let plugin: any
  const source = readFileSync(resolve('node_modules/@deepseek-ai/dsh-client-ui-permission-presets/lib/client.js'), 'utf8')
  new Function('window', source)({ __ModuleLoader__: { load: (bundle: any) => {
    plugin = bundle.factory((name: string) => { if (!(name in modules)) throw new Error(`Unprovided browser module: ${name}`); return modules[name] })
  } } })
  const dictionary: Record<string, Record<string, string>> = {}, registrations = new Map<string, any>()
  const command = vi.fn(async () => ({ ok: true, value: { matched: true } }))
  const catalog = { options: ['read-only', 'workspace-write', 'danger-full-access'].map(value => ({
    value, name: value === 'workspace-write' && customName ? customName : value,
  })) }
  const connection = { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => {} } }
  const ctx: any = {
    get: (name: string) => name === 'connection' ? connection : { decorate: () => () => {}, dismiss: () => {} },
    effect: (effect: () => unknown) => effect(),
    sessions: { binding: () => ({ session: { command } }) },
    remote: { $on: () => () => {}, permissionPresets: { catalog: async () => ({ ok: true, value: catalog }) } },
    configForms: { describe: () => ({}) },
    locale: { register: (ns: string, values: any) => { dictionary[ns] = values.zh; return () => {} },
      bind: (ns: string) => (key: string, params: Record<string, unknown> = {}) => {
        let text = dictionary[ns][key] ?? key
        for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
        return text
      } },
    slots: { inject: (_name: string, register: () => unknown) => register(),
      register: (descriptor: any, component: any) => { registrations.set(descriptor.name, { descriptor, component }); return () => {} } },
  }
  plugin.apply(ctx)
  const { component: Select, descriptor } = registrations.get('conversation.input.permission')
  const injected = descriptor.inject('fixture-session')
  render(<Select locked={locked} select={injected.select} t={ctx.locale.bind(descriptor.locale)}
    useProjection={() => ({ currentValue: 'workspace-write' })}
    usePermissionCatalog={(selector: (value: unknown) => unknown) => selector({ value: catalog })} />)
  return { command }
}

describe('shipped permission picker', () => {
  it('uses the host command and localized labels', async () => {
    const { command } = fixture()
    fireEvent.click(screen.getByRole('button', { name: /访问模式/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: '仅可查看' }))
    await waitFor(() => expect(command).toHaveBeenCalledExactlyOnceWith('/permission read-only'))
  })
  it('retains acknowledgement before full access', async () => {
    const { command } = fixture()
    fireEvent.click(screen.getByRole('button', { name: /访问模式/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: '完全权限' }))
    const confirm = screen.getByRole('button', { name: '启用完全权限' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(command).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(confirm)
    await waitFor(() => expect(command).toHaveBeenCalledExactlyOnceWith('/permission danger-full-access'))
  })
  it('retains custom labels and locked state', () => {
    fixture(true, '研究沙盒')
    const trigger = screen.getByRole('button', { name: /访问模式.*研究沙盒/ }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })
})
