import { describe, expect, it } from 'vitest'
import { pandaMcpPhaseLabel, pandaMcpSignal } from '../src/client/panda-mcp-presentation.ts'

describe('PandaData MCP compact presentation', () => {
  it('maps every Host phase to a concise label and traffic-light signal', () => {
    expect(pandaMcpPhaseLabel('disconnected')).toBe('未连接')
    expect(pandaMcpPhaseLabel('authenticating')).toBe('正在连接…')
    expect(pandaMcpPhaseLabel('connected')).toBe('已连接')
    expect(pandaMcpPhaseLabel('needs_auth')).toBe('需要登录')
    expect(pandaMcpPhaseLabel('error')).toBe('连接失败')

    expect(pandaMcpSignal('disconnected')).toBe('red')
    expect(pandaMcpSignal('error')).toBe('red')
    expect(pandaMcpSignal('authenticating')).toBe('yellow')
    expect(pandaMcpSignal('needs_auth')).toBe('yellow')
    expect(pandaMcpSignal('connected')).toBe('green')
  })
})
