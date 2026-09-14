import { describe, expect, it } from 'vitest'
import { normalizePandaAccount, PandaAccountError } from '../src/account.ts'

describe('normalizePandaAccount', () => {
  it('defaults and normalizes only phone country calling codes', () => {
    expect(normalizePandaAccount({ kind: 'phone', nationalNumber: '138 0013-8000' }))
      .toEqual({ kind: 'phone', login: '+8613800138000' })
    expect(normalizePandaAccount({
      kind: 'phone',
      countryCallingCode: '001',
      nationalNumber: '(202) 555-0100',
    })).toEqual({ kind: 'phone', login: '+12025550100' })
  })

  it('never prefixes email or username identities', () => {
    expect(normalizePandaAccount({ kind: 'email', email: ' user@example.com ' }))
      .toEqual({ kind: 'email', login: 'user@example.com' })
    expect(normalizePandaAccount({ kind: 'username', username: ' panda-user ' }))
      .toEqual({ kind: 'username', login: 'panda-user' })
  })

  it('rejects ambiguous or malformed account fields without echoing them', () => {
    const secretAccount = '+8613800138000'
    let failure: unknown
    try {
      normalizePandaAccount({ kind: 'phone', nationalNumber: secretAccount })
    } catch (error: unknown) {
      failure = error
    }
    expect(failure).toBeInstanceOf(PandaAccountError)
    expect(String(failure)).not.toContain(secretAccount)
    expect(() => normalizePandaAccount({ kind: 'email', email: 'not-an-email' }))
      .toThrow(PandaAccountError)
    expect(() => normalizePandaAccount({ kind: 'phone', countryCallingCode: '+012', nationalNumber: '13800138000' }))
      .toThrow(PandaAccountError)
    expect(() => normalizePandaAccount({ kind: 'phone', countryCallingCode: '+999', nationalNumber: '12345678901234' }))
      .toThrow(PandaAccountError)
    expect(() => normalizePandaAccount({ kind: 'username', username: ' ' }))
      .toThrow(PandaAccountError)
    expect(() => normalizePandaAccount({ kind: 'username', username: 'x'.repeat(321) }))
      .toThrow(PandaAccountError)
    expect(() => normalizePandaAccount({ kind: 'unsupported' } as never))
      .toThrow(PandaAccountError)
  })
})
