/** 用系统浏览器打开远端 OAuth 授权页。 */

import { spawn } from 'node:child_process'

interface BrowserLaunch {
  readonly command: string
  readonly args: readonly string[]
}

/**
 * Resolve a shell-free browser launch so OAuth query parameters stay intact.
 * @param href - Complete authorization URL.
 * @param platform - Runtime platform.
 * @returns Executable and arguments passed directly to the operating system.
 */
export function systemBrowserLaunch(href: string, platform: NodeJS.Platform = process.platform): BrowserLaunch {
  const url = new URL(href)
  if (platform === 'win32') {
    return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url.href] }
  }
  return { command: platform === 'darwin' ? 'open' : 'xdg-open', args: [url.href] }
}

/**
 * 打开系统默认浏览器。失败时抛出不含 URL 查询串的错误。
 * @param href - 完整授权 URL。
 */
export function openSystemBrowser(href: string): Promise<void> {
  const launch = systemBrowserLaunch(href)
  return new Promise((resolve, reject) => {
    const child = spawn(launch.command, launch.args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('error', () => reject(new Error('无法打开本机浏览器，请使用 QuantSkills 网页授权。')))
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('本机浏览器启动失败，请使用 QuantSkills 网页授权。')))
    child.unref()
  })
}
