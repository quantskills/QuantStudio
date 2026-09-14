import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { installLocalBrowserAccess, type LocalBrowserConnection } from '../src/local-browser-access.ts'

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

function fixture() {
  const ctx = new Context()
  contexts.push(ctx)
  const browserAuth = {
    isAuthenticated: (req: { headers: Record<string, string> }) => req.headers.cookie === 'valid-session',
    authorizeIndex: vi.fn((_req: unknown, res: { writeHead(status: number): void; end(): void }) => { res.writeHead(401); res.end(); return false }),
    authenticatedUrl: vi.fn((url: string) => `${url}/?token=remote-test-token`),
  }
  const connection = new HostConnectionService(ctx, ['192.168.1.10:3198'], browserAuth as never)
  const restore = installLocalBrowserAccess(connection)
  return { connection, browserAuth, restore, ctx }
}

function request(host = '127.0.0.1:3198', headers: Record<string, string> = {}) {
  return { method: 'GET', url: '/', headers: { host, ...headers }, socket: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1', localPort: 3198 } }
}
const response = () => ({ writeHead: vi.fn(), end: vi.fn() })

describe('QuantSkills local browser access', () => {
  it.each(['127.0.0.1:3198', 'localhost:3198', '[::1]:3198'])('opens %s without cookies or a token', host => {
    const { connection, browserAuth } = fixture()
    const req = request(host)
    const res = response()
    expect(connection.authorizeIndex(req, res)).toBe(true)
    expect(connection.requestRejection(req)).toBeUndefined()
    expect(res.writeHead).not.toHaveBeenCalled()
    expect(browserAuth.authorizeIndex).not.toHaveBeenCalled()
    expect(connection.authenticatedUrl(`http://${host}`)).toBe(`http://${host}/`)
  })

  it.each(['::1', '::ffff:127.0.0.1'])('accepts local IPv6 transport %s', address => {
    const { connection } = fixture()
    const req = request()
    req.socket.remoteAddress = address
    req.socket.localAddress = address
    expect(connection.requestRejection(req)).toBeUndefined()
  })

  it.each([
    { origin: 'https://evil.example' },
    { origin: 'null' },
    { origin: 'http://localhost:4000' },
    { 'sec-fetch-site': 'cross-site' },
  ])('keeps the browser origin fence for index and API: %j', headers => {
    const { connection } = fixture()
    const req = request('127.0.0.1:3198', headers)
    const res = response()
    expect(connection.requestRejection(req)).toBe(403)
    expect(connection.authorizeIndex(req, res)).toBe(false)
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object))
  })

  it('allows same-origin browser API calls', () => {
    const { connection } = fixture()
    expect(connection.requestRejection(request('localhost:3198', { origin: 'http://localhost:3198', 'sec-fetch-site': 'same-origin' }))).toBeUndefined()
  })

  it.each(['evil.example:3198', 'localhost.evil.example:3198', '192.168.1.10:3198'])('does not grant anonymous access to %s', host => {
    const { connection, browserAuth } = fixture()
    expect(connection.requestRejection(request(host))).toBeDefined()
    expect(connection.authorizeIndex(request(host), response())).toBe(false)
    expect(browserAuth.authorizeIndex).toHaveBeenCalledOnce()
  })

  it.each(['remoteAddress', 'localAddress'] as const)('requires a loopback %s even with a forged local Host', field => {
    const { connection } = fixture()
    const req = request()
    req.socket[field] = '192.168.1.20'
    expect(connection.requestRejection(req)).toBe(401)
    expect(connection.authorizeIndex(req, response())).toBe(false)
  })

  it.each(['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'])('does not exempt proxied requests with %s', name => {
    const { connection } = fixture()
    expect(connection.requestRejection(request('127.0.0.1:3198', { [name]: '127.0.0.1' }))).toBe(401)
  })

  it('fails closed without transport facts or with a mismatched port', () => {
    const { connection } = fixture()
    expect(connection.requestRejection({ headers: { host: 'localhost:3198' } })).toBe(401)
    expect(connection.requestRejection(request('localhost:4000'))).toBe(401)
  })

  it('preserves existing remote cookie authentication and remote token URLs', () => {
    const { connection } = fixture()
    const req = request('192.168.1.10:3198', { cookie: 'valid-session' })
    req.socket.remoteAddress = '192.168.1.20'
    expect(connection.requestRejection(req)).toBeUndefined()
    expect(connection.authenticatedUrl('http://192.168.1.10:3198')).toContain('token=remote-test-token')
  })

  it('cleans old launch links without creating a cookie', () => {
    const { connection } = fixture()
    const req = { ...request(), url: '/?token=old-token&view=home' }
    const res = response()
    expect(connection.authorizeIndex(req, res)).toBe(false)
    expect(res.writeHead).toHaveBeenCalledWith(303, { location: '/?view=home', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
  })

  it('affects other Cordis consumers and restores authentication on disposal', () => {
    const { connection, restore, ctx } = fixture()
    const other = ctx.get('connection') as unknown as LocalBrowserConnection
    expect(other.requestRejection(request())).toBeUndefined()
    restore()
    expect(connection.requestRejection(request())).toBe(401)
    expect(other.requestRejection(request())).toBe(401)
    expect(connection.authenticatedUrl('http://127.0.0.1:3198')).toContain('token=')
  })
})
