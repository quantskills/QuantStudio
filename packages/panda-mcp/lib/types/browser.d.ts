/** 用系统浏览器打开远端 OAuth 授权页。 */
interface BrowserLaunch {
    readonly command: string;
    readonly args: readonly string[];
}
/**
 * Resolve a shell-free browser launch so OAuth query parameters stay intact.
 * @param href - Complete authorization URL.
 * @param platform - Runtime platform.
 * @returns Executable and arguments passed directly to the operating system.
 */
export declare function systemBrowserLaunch(href: string, platform?: NodeJS.Platform): BrowserLaunch;
/**
 * 打开系统默认浏览器。失败时抛出不含 URL 查询串的错误。
 * @param href - 完整授权 URL。
 */
export declare function openSystemBrowser(href: string): void;
export {};
//# sourceMappingURL=browser.d.ts.map