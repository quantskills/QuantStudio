import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  SubprocessHandle,
  SubprocessOutputRead,
  SubprocessSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import {
  PandaWorkerClient,
  type PandaProcessRuntime,
  type PandaWorkerConfig,
} from '../src/worker.ts'

function environmentPython(root: string): string {
  return process.platform === 'win32'
    ? join(root, 'Scripts', 'python.exe')
    : join(root, 'bin', 'python')
}

class LauncherRuntime implements PandaProcessRuntime {
  readonly resolved: string[] = []
  readonly spawned: SubprocessSpawnSpec[] = []
  readonly available = new Set<string>()

  async resolveExecutable(command: string): Promise<string> {
    this.resolved.push(command)
    if (!this.available.has(command)) throw new Error('not found')
    return command
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.spawned.push(spec)
    const request = JSON.parse(spec.stdio.stdin === 'ignore' || spec.stdio.stdin === 'pipe'
      ? '{}'
      : spec.stdio.stdin.data) as { requiredSdkVersion?: string }
    const output = JSON.stringify({
      ok: true,
      installedSdkVersion: request.requiredSdkVersion ?? null,
      logoutSupported: false,
      authenticated: false,
      dataValidated: false,
      pythonVersion: '3.11.9',
      pythonSource: 'configured',
      publicCallables: [],
      apiFingerprint: 'test-fingerprint',
      capabilities: { authentication: true, marketData: true, indexData: true, marginData: true },
    })
    const read = (): SubprocessOutputRead => ({
      text: output,
      nextOffset: Buffer.byteLength(output),
      lossy: false,
    })
    const done = Promise.resolve({ exitCode: 0, signal: null })
    return {
      pid: 1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: { readFrom: read }, stderr: { readFrom: read } },
      done,
      terminate: () => undefined,
      waitForExit: async () => true,
    }
  }
}

function config(projectRoot: string, overrides: Partial<PandaWorkerConfig> = {}): PandaWorkerConfig {
  return {
    pythonCommand: 'python',
    pythonArgs: ['configured-arg'],
    projectRoot,
    runtimeManagerRoot: resolve(projectRoot, 'runtime-manager'),
    managedPythonVersion: '3.11',
    baseURL: 'https://data.example.test',
    operationTimeoutMs: 60_000,
    bootstrapTimeoutMs: 60_000,
    terminateGraceMs: 1_000,
    maxOutputBytes: 65_536,
    ...overrides,
  }
}

describe('PandaWorkerClient Python discovery', () => {
  it('uses an active virtual environment before project and system launchers', async () => {
    const projectRoot = resolve('project with spaces')
    const activePython = environmentPython(resolve('active environment'))
    const runtime = new LauncherRuntime()
    runtime.available.add(activePython)

    const client = new PandaWorkerClient(runtime, config(projectRoot, {
      activeVirtualEnvironment: resolve('active environment'),
    }))
    await client.bootstrapAt(resolve('candidate'), '0.0.12', undefined, undefined)

    expect(runtime.resolved).toEqual([activePython])
    expect(runtime.spawned[0]?.argv.slice(0, 2)).toEqual([activePython, '-I'])
  })

  it('finds a project .ven before falling back to the configured launcher', async () => {
    const projectRoot = resolve('project with spaces')
    const projectPython = environmentPython(join(projectRoot, '.ven'))
    const runtime = new LauncherRuntime()
    runtime.available.add(projectPython)
    runtime.available.add('python')

    const client = new PandaWorkerClient(runtime, config(projectRoot))
    await client.bootstrapAt(resolve('candidate'), '0.0.12', undefined, undefined)

    expect(runtime.resolved).toEqual([
      environmentPython(join(projectRoot, '.venv')),
      projectPython,
    ])
    expect(runtime.spawned[0]?.argv.slice(0, 2)).toEqual([projectPython, '-I'])
  })

  it('preserves explicit launcher arguments when no local virtual environment exists', async () => {
    const projectRoot = resolve('project')
    const runtime = new LauncherRuntime()
    runtime.available.add('python')

    const client = new PandaWorkerClient(runtime, config(projectRoot))
    await client.bootstrapAt(resolve('candidate'), '0.0.12', undefined, undefined)

    expect(runtime.resolved).toEqual([
      environmentPython(join(projectRoot, '.venv')),
      environmentPython(join(projectRoot, '.ven')),
      environmentPython(join(projectRoot, 'venv')),
      'python',
    ])
    expect(runtime.spawned[0]?.argv.slice(0, 3)).toEqual(['python', 'configured-arg', '-I'])
  })

  it('keeps an explicit absolute Python configuration authoritative', async () => {
    const projectRoot = resolve('project')
    const explicitPython = environmentPython(resolve('explicit environment'))
    const runtime = new LauncherRuntime()
    runtime.available.add(explicitPython)

    const client = new PandaWorkerClient(runtime, config(projectRoot, {
      pythonCommand: explicitPython,
      pythonArgs: ['explicit-arg'],
      activeVirtualEnvironment: resolve('active environment'),
    }))
    await client.bootstrapAt(resolve('candidate'), '0.0.12', undefined, undefined)

    expect(runtime.resolved).toEqual([explicitPython])
    expect(runtime.spawned[0]?.argv.slice(0, 3)).toEqual([explicitPython, 'explicit-arg', '-I'])
  })
})
