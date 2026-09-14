import { describe, expect, it } from 'vitest'
import { startOauthLoopback } from '../src/callback-server.ts'

describe('PandaData OAuth callback', () => {
  it('rejects unsolicited callbacks without consuming the pending authorization', async () => {
    const callback = await startOauthLoopback()
    try {
      const wrong = await fetch(callback.localCallbackUrl + '?code=untrusted&state=wrong')
      expect(wrong.status).toBe(403)
      const pending = callback.waitForCode()
      const response = await fetch(callback.localCallbackUrl + '?code=verified&state=' + callback.state)
      expect(response.status).toBe(200)
      await expect(pending).resolves.toBe('verified')
    } finally { await callback.close() }
  })

  it('uses the public callback URI and returns the browser to its workspace', async () => {
    const callback = await startOauthLoopback({ publicOrigin: 'https://workspace.example', port: 0 })
    try {
      expect(callback.redirectUrl).toBe('https://workspace.example/api/quantskills/panda-oauth/callback')
      const pending = callback.waitForCode()
      const response = await fetch(callback.localCallbackUrl + '?code=verified&state=' + callback.state, { redirect: 'manual' })
      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe('https://workspace.example/')
      await expect(pending).resolves.toBe('verified')
    } finally { await callback.close() }
  })
})
