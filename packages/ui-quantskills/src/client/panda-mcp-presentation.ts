import type { PandaMcpStatus } from './plugin-types.ts'

/** Traffic-light color used by compact PandaData MCP status controls. */
export type PandaMcpSignal = 'red' | 'yellow' | 'green'

/** Resolve one Host phase to its concise Chinese status label. */
export function pandaMcpPhaseLabel(phase: PandaMcpStatus['phase']): string {
  if (phase === 'connected') return '已连接'
  if (phase === 'authenticating') return '正在连接…'
  if (phase === 'needs_auth') return '需要登录'
  if (phase === 'error') return '连接失败'
  return '未连接'
}

/** Resolve one Host phase to the user-visible red/yellow/green signal. */
export function pandaMcpSignal(phase: PandaMcpStatus['phase']): PandaMcpSignal {
  if (phase === 'connected') return 'green'
  if (phase === 'authenticating' || phase === 'needs_auth') return 'yellow'
  return 'red'
}
