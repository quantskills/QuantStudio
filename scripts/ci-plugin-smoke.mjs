import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const pnpmCli = process.env.npm_execpath
const port = Number.parseInt(process.env.QUANTSKILLS_CI_PORT ?? '39157', 10)
const timeoutMs = Number.parseInt(process.env.QUANTSKILLS_CI_TIMEOUT_MS ?? '120000', 10)

if (!pnpmCli) {
  throw new Error('npm_execpath is required to run the pinned pnpm CLI')
}

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`Invalid QUANTSKILLS_CI_PORT: ${process.env.QUANTSKILLS_CI_PORT ?? ''}`)
}

const dshHome = await mkdtemp(path.join(tmpdir(), 'quantskills-ci-'))
const environment = {
  ...process.env,
  CI: 'true',
  DSH_HOME: dshHome,
  QUANTSKILLS_DISABLE_APPLICATION_UPDATE: '1',
}

let host
let publishedUrl
let stdoutBuffer = ''

try {
  runPnpm(['run', 'install:plugin'])

  host = spawn(
    process.execPath,
    [pnpmCli, 'exec', 'dsh', '--profile', 'web', '--port', String(port), '--no-open'],
    {
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )

  host.stdout.on('data', (chunk) => {
    stdoutBuffer = `${stdoutBuffer}${chunk.toString()}`.slice(-4_096)
    const match = stdoutBuffer.match(/dsh web:\s+(https?:\/\/[^\s\u001b]+)/)
    if (match) {
      publishedUrl = match[1]
    }
  })
  host.stdout.pipe(process.stdout)
  host.stderr.pipe(process.stderr)

  const readyUrl = await waitForHost(() => publishedUrl, timeoutMs)
  console.log(`QuantSkills DSH smoke test passed at ${readyUrl}`)
} finally {
  stopProcessTree(host)
  await rm(dshHome, { recursive: true, force: true })
}

function runPnpm(args) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} exited with status ${result.status}`)
  }
}

async function waitForHost(resolveUrl, limitMs) {
  const deadline = Date.now() + limitMs

  while (Date.now() < deadline) {
    if (host.exitCode !== null) {
      throw new Error(`DSH exited before becoming ready with status ${host.exitCode}`)
    }

    const url = resolveUrl()
    if (!url) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      continue
    }

    try {
      const authentication = await fetch(url, { redirect: 'manual' })
      let response = authentication
      if (authentication.status === 303) {
        const location = authentication.headers.get('location')
        const cookie = authentication.headers.get('set-cookie')?.split(';', 1)[0]
        if (!location || !cookie) {
          throw new Error('DSH authentication redirect omitted its location or cookie')
        }
        response = await fetch(new URL(location, url), {
          headers: { cookie },
        })
      }
      if (response.ok) {
        const html = await response.text()
        if (!html.toLowerCase().includes('<html')) {
          throw new Error('DSH returned a non-HTML response')
        }
        return url
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'DSH returned a non-HTML response') {
        throw error
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(`DSH did not become ready within ${limitMs} ms`)
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) {
    return
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }

  child.kill('SIGTERM')
}
