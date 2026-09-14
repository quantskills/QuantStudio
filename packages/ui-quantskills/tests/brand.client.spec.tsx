// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import { createQuantSkillsViewStore } from '../src/client/store.ts'
import {
  installQuantSkillsDocumentBrand, QuantSkillsBrandLockup, QuantSkillsBrandMark,
  QuantSkillsConversationHeroIdentity, QuantSkillsConversationStatus,
} from '../src/client/QuantSkillsBrand.tsx'

afterEach(cleanup)

describe('QuantSkills brand ownership', () => {
  it('renders the PandaAI endorsement only in the wide lockup', () => {
    const lockup = render(<QuantSkillsBrandLockup />)

    expect(screen.getByRole('img', { name: 'QuantSkills by PandaAI' })).toBeTruthy()
    expect(screen.getByText('PandaAI')).toBeTruthy()
    expect(lockup.container.querySelectorAll('img')).toHaveLength(2)

    lockup.unmount()
    const compact = render(<QuantSkillsBrandMark size={30} />)

    expect(compact.container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.queryByText('PandaAI')).toBeNull()
  })

  it('renders the QuantSkills title with the Hero mark requested by DSH', () => {
    const view = createQuantSkillsViewStore().create()
    const subject = render(<QuantSkillsConversationHeroIdentity
      mode="standalone"
      useView={bindSnapshotSelector(view.store)}
      defaultMark={<span>DSH</span>}
      defaultHeadline="DeepSeek Harness"
      size={34}
      className="host-mark"
      renderIdentity={(mark, headline) => <div>{mark}<span>{headline}</span></div>}
    />)

    expect(screen.getByText('QuantSkills 量化研究工作台')).toBeTruthy()
    expect(subject.container.querySelector('img.host-mark')).toBeTruthy()
  })

  it('replaces the stock DSH window and taskbar metadata for its lifetime', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.svg"><link rel="manifest" href="/manifest.webmanifest">'

    const dispose = installQuantSkillsDocumentBrand()

    const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const manifest = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    expect(icon?.type).toBe('image/png')
    expect(icon?.href).toMatch(/(?:^data:image\/png;base64,|quantskills-mark\.png$)/u)
    expect(manifest?.href).toMatch(/^(?:blob:|data:application\/manifest\+json)/u)
    expect(document.head.querySelector('link[href="/favicon.svg"]')).toBeNull()

    dispose()
    expect(document.head.querySelector('link[href="/favicon.svg"]')).toBeTruthy()
    expect(document.head.querySelector('link[href="/manifest.webmanifest"]')).toBeTruthy()
  })

  it('restores the animated brand and rotates quiet status copy without leaking timers', () => {
    vi.useFakeTimers()
    const view = createQuantSkillsViewStore().create()
    const subject = render(<QuantSkillsConversationStatus
      mode="standalone"
      useView={bindSnapshotSelector(view.store)}
      defaultLabel="Deep diving…"
    />)

    expect(screen.getByRole('status', { name: 'QuantSkills 正在分析，请稍候' })).toBeTruthy()
    try {
      expect(screen.getByText('正在深入研究…')).toBeTruthy()
      expect([...subject.container.querySelectorAll('img')].map(img => img.src)).toEqual(expect.arrayContaining([
        expect.stringMatching(/research-mark-light\.webp$/u),
        expect.stringMatching(/research-mark-dark\.webp$/u),
      ]))
      act(() => { vi.advanceTimersByTime(5_000) })
      expect(screen.getByText('给灵感一点加速度…')).toBeTruthy()
      expect(screen.queryByText('正在深入研究…')).toBeNull()
      subject.unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves the session title while replacing host branding after navigation', async () => {
    document.title = 'DeepSeek Harness'
    const dispose = installQuantSkillsDocumentBrand()
    expect(document.title).toBe('QuantSkills')
    document.title = '因子研究 — DSH 本地构建'
    await waitFor(() => { expect(document.title).toBe('因子研究 — QuantSkills') })
    dispose()
    document.title = 'Original host'
    await Promise.resolve()
    expect(document.title).toBe('Original host')
  })
})
