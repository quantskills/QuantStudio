import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { FlyRequest, FlyRuntimeStatus } from '@deepseek-ai/dsh-quantskills-session/src/fly-runtime.ts'

export interface FlyAccess {
  status(): Promise<FlyRuntimeStatus>
  install(input?: { neural?: boolean }): Promise<FlyRuntimeStatus>
  request(input: FlyRequest): Promise<JsonValue>
}
let access: FlyAccess | undefined
export function connectFlyTransport(value: FlyAccess) { access = value }
export async function flyApi<T>(path: string, body?: unknown): Promise<T> {
  if (!access) throw new Error('AI 交易员服务尚未连接')
  return await access.request({ path, ...(body === undefined ? {} : { body: body as JsonValue }) }) as T
}
export async function flyFetch(url: string, init?: RequestInit): Promise<Response> {
  const prefix = '/api/fly/v2/'
  if (!url.startsWith(prefix)) throw new Error('AI 交易员接口路径无效')
  init?.signal?.throwIfAborted()
  const result = await flyApi(url.slice(prefix.length), typeof init?.body === 'string' ? JSON.parse(init.body) : undefined)
  init?.signal?.throwIfAborted()
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
}
const assets = new Map<string, Promise<string>>()
export function flyAsset(version: string, name: 'home.glb' | 'preview.png'): Promise<string> {
  const path = `asset/${version}/${name}`
  let result = assets.get(path)
  if (!result) {
    result = flyApi<{ url: string }>(path).then(value => value.url).catch(error => { assets.delete(path); throw error })
    assets.set(path, result)
  }
  return result
}
