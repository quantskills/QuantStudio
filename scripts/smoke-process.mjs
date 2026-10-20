import { spawnSync } from 'node:child_process'

/** Only for smoke children forked with detached:true on POSIX (their own group). */
export async function stopSmokeProcess(child) {
  if (!child?.pid) return
  const group = signal => {
    try { process.kill(-child.pid, signal) } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  if (process.platform === 'win32') {
    if (child.exitCode === null) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } else group('SIGTERM')
  await new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve() }, 5000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
  })
  // A launcher can exit before a descendant which ignores TERM. The isolated
  // group is ours even after the launcher exits; never target the caller's group.
  if (process.platform !== 'win32') group('SIGKILL')
}
