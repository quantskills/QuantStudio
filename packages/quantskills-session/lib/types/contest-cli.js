/** Private, lazy official CLI runtime. No shell strings or global npm installation. */
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
export const CONTEST_PACKAGE = '@chongqingliangyunzhijing/contest-cli';
export const CONTEST_ORIGIN = 'https://www.pandaaiquant.com';
export class ContestCliError extends Error {
    code;
    retryAfterSeconds;
    constructor(code, message, retryAfterSeconds) {
        super(message);
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
export const transientContestCodes = new Set(['rate_limit_exceeded', 'timeout', 'network_error', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504']);
/** Older CLIs wrap gateway HTML errors as bad_response. Keep only the HTTP status. */
export function contestFailureCode(rawCode, message) {
    const code = String(rawCode ?? 'cli_failed').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    if (code !== 'bad_response' || typeof message !== 'string')
        return code;
    const status = /^(?:bad_response:\s*)?服务返回了非 JSON 内容[（(]HTTP (500|502|503|504)[）)]/.exec(message)?.[1];
    return status ? `http_${status}` : code;
}
export function record(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
/** Remove credential fields even if upstream adds them to a response. */
export function safeData(value) {
    if (Array.isArray(value))
        return value.map(safeData);
    if (typeof value === 'object' && value !== null)
        return Object.fromEntries(Object.entries(value)
            .filter(([key]) => !/token|password|secret|credential|authorization|cookie|phone|email|realName|idCard/i.test(key))
            .map(([key, item]) => [key, safeData(item)]));
    return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' ? value : null;
}
export function parseCliOutput(text) {
    let body;
    try {
        body = record(JSON.parse(text));
    }
    catch {
        throw new Error('比赛 CLI 返回了无法解析的结果，请重新检查连接。');
    }
    if (body.ok !== true) {
        const code = contestFailureCode(record(body.error).code, record(body.error).message);
        const unavailable = /^http_(500|502|503|504)$/.exec(code)?.[1];
        const messages = {
            market_closed: '当前合约休市，请在交易时段重新预演。',
            unauthorized: '比赛登录已失效，请重新连接。',
            login_required: '比赛登录已失效，请重新连接。',
            confirmation_required: '请在交易计划卡中确认执行。',
            plan_expired: '交易计划已过期，请重新预演。',
            variety_ambiguous: '品种简称不明确，请填写完整品种名或实际合约。',
            no_browser: '比赛登录需要在 Windows 或 macOS 本机打开浏览器。',
            bad_response: '比赛接口返回了无法识别的响应，请稍后重试。',
        };
        const error = record(body.error), details = record(error.detail ?? error.details), meta = record(body.meta);
        const retry = Number(error.retryAfterSeconds ?? error.retryAfter ?? error.retry_after ?? details.retryAfterSeconds ?? details.retryAfter ?? details.retry_after ?? meta.retryAfterSeconds ?? meta.retryAfter ?? meta.retry_after);
        throw new ContestCliError(code, unavailable
            ? `比赛服务暂时不可用（HTTP ${unavailable}），当前无法读取账户和行情。请等待服务恢复后重试。`
            : messages[code] ?? `比赛 CLI 操作未完成（${code}）。请检查连接和账户状态。`, Number.isFinite(retry) && retry > 0 ? Math.min(86400, retry) : undefined);
    }
    return { data: safeData(body.data), ...(body.meta === undefined ? {} : { meta: record(safeData(body.meta)) }), fetchedAt: Date.now() };
}
export function versionAtLeast(version, minimum) {
    if (!/^\d+\.\d+\.\d+$/.test(version) || !/^\d+\.\d+\.\d+$/.test(minimum))
        return false;
    const a = version.split('.').map(Number), b = minimum.split('.').map(Number);
    for (let i = 0; i < 3; i++)
        if (a[i] !== b[i])
            return a[i] > b[i];
    return true;
}
export class OfficialContestCli {
    processes;
    authHome;
    constructor(processes, authHome) {
        this.processes = processes;
        this.authHome = authHome;
    }
    async process(argv, cwd, signal, timeoutMs = 45_000) {
        const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
        deadline.throwIfAborted();
        const handle = this.processes().spawn({
            argv, cwd, signal: deadline, graceMs: 1500,
            stdio: { stdin: 'ignore', stdout: { maxBytes: 2 * 1024 * 1024 }, stderr: { maxBytes: 32_768 } },
            env: { PANDA_TRADE_HOME: this.authHome, PANDA_API_BASE: CONTEST_ORIGIN, PANDA_CLIENT_ID: undefined,
                NODE_OPTIONS: undefined, npm_config_prefix: cwd },
        });
        try {
            const outcome = await handle.done;
            deadline.throwIfAborted();
            const output = handle.collected.stdout?.readFrom(0);
            if (!output || output.lossy)
                throw new Error('比赛 CLI 输出超过限制，请缩小查询范围。');
            // Failure envelopes contain safe error codes; never expose raw stderr or argv.
            if (outcome.exitCode !== 0 && !output.text.trim().startsWith('{'))
                throw new Error('比赛 CLI 未能完成操作，请检查网络及 Node.js/npm 环境。');
            return output.text.trim();
        }
        finally {
            handle.terminate();
            await handle.waitForExit(AbortSignal.timeout(5000));
        }
    }
    async run(runtime, args, signal) {
        const bin = join(runtime, 'node_modules', CONTEST_PACKAGE, 'bin', 'panda.js');
        return parseCliOutput(await this.process([process.execPath, bin, ...args, '--json'], runtime, signal, args[0] === 'login' ? 310_000 : 45_000));
    }
    async install(runtime, signal) {
        if (process.platform !== 'win32' && process.platform !== 'darwin')
            throw new Error('首版比赛模式支持 Windows 与 macOS 本机运行。');
        const publicDocument = async (path) => {
            const response = await fetch(`${CONTEST_ORIGIN}/openapi/v1/${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), redirect: 'error' });
            if (!response.ok)
                throw new Error('无法读取官方比赛接入文档。');
            const text = await response.text();
            if (text.length > 128_000)
                throw new Error('官方比赛接入文档超过大小限制。');
            return text;
        };
        // Verify the public protocol before installing or initiating authorization.
        await publicDocument('agent-install-guide/cli');
        const index = record(record(JSON.parse(await publicDocument('skills/index.json'))).data);
        if (!Array.isArray(index.skills) || !index.skills.some(item => record(item).name === 'panda-trading'))
            throw new Error('官方交易技能清单缺失。');
        const publicRules = await publicDocument('skills/trading/SKILL.md');
        const spec = record(record(JSON.parse(await publicDocument('meta/agent-spec'))).data);
        if (!publicRules.includes('name: panda-trading') || typeof spec.minimumCliVersion !== 'string')
            throw new Error('官方交易协议不完整。');
        await mkdir(runtime, { recursive: true, mode: 0o700 });
        await mkdir(this.authHome, { recursive: true, mode: 0o700 });
        const npmPath = await this.processes().resolveExecutable(process.platform === 'win32' ? 'npm.cmd' : 'npm', undefined, signal);
        const npmScript = process.platform === 'win32' ? join(dirname(npmPath), 'node_modules/npm/bin/npm-cli.js') : await realpath(npmPath);
        await this.process([process.execPath, npmScript, 'install', '--prefix', runtime, '--ignore-scripts', '--no-audit', '--no-fund',
            '--package-lock=false', '--registry=https://registry.npmjs.org', `${CONTEST_PACKAGE}@latest`], runtime, signal, 240_000);
        const version = (await this.process([process.execPath, join(runtime, 'node_modules', CONTEST_PACKAGE, 'bin/panda.js'), '--version'], runtime, signal)).trim();
        // The CLI downloads the official skill and agent-spec into this private cwd.
        await this.run(runtime, ['skill', 'install', '--client', 'codex'], signal);
        if (typeof spec.minimumCliVersion !== 'string' || !versionAtLeast(version, spec.minimumCliVersion))
            throw new Error('比赛 CLI 版本未通过服务端兼容性检查。');
        const rules = await readFile(join(runtime, '.codex/skills/panda-trading/SKILL.md'), 'utf8');
        if (rules.length > 128_000 || !rules.includes('name: panda-trading') || !rules.includes(`version: ${String(spec.skillVersion)}`))
            throw new Error('官方交易规则校验失败。');
        return { version, rules };
    }
}
//# sourceMappingURL=contest-cli.js.map