/** 用系统浏览器打开远端 OAuth 授权页。 */
import { spawn } from 'node:child_process';
/**
 * Resolve a shell-free browser launch so OAuth query parameters stay intact.
 * @param href - Complete authorization URL.
 * @param platform - Runtime platform.
 * @returns Executable and arguments passed directly to the operating system.
 */
export function systemBrowserLaunch(href, platform = process.platform) {
    const url = new URL(href);
    if (platform === 'win32') {
        return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url.href] };
    }
    return { command: platform === 'darwin' ? 'open' : 'xdg-open', args: [url.href] };
}
/**
 * 打开系统默认浏览器。失败时抛出不含 URL 查询串的错误。
 * @param href - 完整授权 URL。
 */
export function openSystemBrowser(href) {
    const launch = systemBrowserLaunch(href);
    spawn(launch.command, launch.args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
//# sourceMappingURL=browser.js.map