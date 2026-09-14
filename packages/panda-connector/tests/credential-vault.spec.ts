import { describe, expect, it, vi } from 'vitest'
import {
  PandaCredentialVaultUnavailableError,
  PandaOsCredentialVault,
  type PandaStoredCredential,
} from '../src/credential-vault.ts'

interface FakeState {
  password: string | undefined
  fail: boolean
  deleted: number
}

function keyring(state: FakeState) {
  class AsyncEntry {
    constructor(readonly service: string, readonly username: string) {}

    async getPassword(): Promise<string | undefined> {
      if (state.fail) throw new Error('native-detail')
      return state.password
    }

    async setPassword(password: string): Promise<void> {
      if (state.fail) throw new Error('native-detail')
      state.password = password
    }

    async deletePassword(): Promise<boolean> {
      if (state.fail) throw new Error('native-detail')
      const existed = state.password !== undefined
      state.password = undefined
      state.deleted += 1
      return existed
    }
  }
  return { AsyncEntry }
}

const credential: PandaStoredCredential = {
  schemaVersion: 1,
  account: { kind: 'username', login: 'vault-user' },
  password: 'vault-password',
}

describe('PandaOsCredentialVault', () => {
  it('round-trips one validated credential and deletes it from the OS entry', async () => {
    const state: FakeState = { password: undefined, fail: false, deleted: 0 }
    const load = vi.fn(async () => keyring(state))
    const vault = new PandaOsCredentialVault(load)

    await expect(vault.status()).resolves.toBe('available')
    await vault.write(credential)
    await expect(vault.read()).resolves.toEqual(credential)
    await vault.delete()
    await expect(vault.read()).resolves.toBeUndefined()
    expect(load).toHaveBeenCalledOnce()
  })

  it('deletes malformed durable data instead of exposing it to the connector', async () => {
    const state: FakeState = { password: '{"schemaVersion":1,"password":"secret"}', fail: false, deleted: 0 }
    const vault = new PandaOsCredentialVault(async () => keyring(state))

    await expect(vault.read()).resolves.toBeUndefined()
    expect(state.deleted).toBe(1)
    expect(state.password).toBeUndefined()
  })

  it('maps native load and operation failures to one redacted unavailable result', async () => {
    const state: FakeState = { password: undefined, fail: true, deleted: 0 }
    const vault = new PandaOsCredentialVault(async () => keyring(state))

    await expect(vault.status()).resolves.toBe('unavailable')
    await expect(vault.read()).rejects.toBeInstanceOf(PandaCredentialVaultUnavailableError)
    await expect(vault.write(credential)).rejects.toBeInstanceOf(PandaCredentialVaultUnavailableError)
    await expect(vault.delete()).rejects.toBeInstanceOf(PandaCredentialVaultUnavailableError)
  })
})
