/** Official research CLI in a private Python environment; credentials stay in the Host. */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { record, safeData } from "./contest-cli.js";
const GATEWAY = 'https://www.pandaaiquant.com/pandaApi';
const ARENA = 'https://api.pandaaiquant.com';
/** Keep Python's deeply nested dependencies below Windows' legacy path limit.
 * The complete logical runtime path (including its UUID) keeps homes and updates isolated.
 * Credentials and persisted competition state remain in the original DSH home.
 */
export function factorRuntimeDirectory(runtime) {
    const absolute = resolve(runtime);
    if (process.platform !== 'win32' || absolute.length <= 100)
        return runtime;
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'QuantStudio', 'factor', createHash('sha256').update(absolute).digest('hex').slice(0, 24));
}
export class FactorApiError extends Error {
    code;
    rejected;
    constructor(code, rejected = false) {
        super({ LOGIN_REQUIRED: '因子账户登录已失效，请重新连接。', POOL_NOT_FOUND: '尚未创建比赛因子池。',
            MODIFICATION_WINDOW_CLOSED: '当前不在赛事修改窗口内。', DUPLICATE_FACTOR: '赛事已存在相同因子，请核对池内工作流。',
            INSUFFICIENT_BALANCE: '算力余额不足。', LOGIN_FAILED: '登录失败，请核对手机号和密码。',
        }[code] ?? `因子平台操作未完成（${code}），请刷新状态后核对。`);
        this.code = code;
        this.rejected = rejected;
    }
}
export class OfficialFactorRuntime {
    processes;
    authHome;
    constructor(processes, authHome) {
        this.processes = processes;
        this.authHome = authHome;
    }
    configPath() { return join(this.authHome, 'config.json'); }
    python(runtime) { return join(runtime, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'); }
    async process(argv, cwd, signal, timeout = 60_000) {
        const active = AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
        active.throwIfAborted();
        const handle = this.processes().spawn({ argv, cwd, signal: active, graceMs: 1500,
            stdio: { stdin: 'ignore', stdout: { maxBytes: 4 * 1024 * 1024 }, stderr: { maxBytes: 16_384 } },
            env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONPATH: undefined, PYTHONHOME: undefined,
                PIP_CONFIG_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null', PIP_EXTRA_INDEX_URL: undefined },
        });
        try {
            const result = await handle.done;
            active.throwIfAborted();
            const output = handle.collected.stdout?.readFrom(0);
            if (!output || output.lossy)
                throw new Error('因子 CLI 输出超过限制，请缩小查询范围。');
            if (result.exitCode !== 0 && !output.text.trim().startsWith('{'))
                throw new Error('因子 CLI 运行失败，请检查 Python、网络和安装状态。');
            return output.text.trim();
        }
        finally {
            handle.terminate();
            await handle.waitForExit(AbortSignal.timeout(5000));
        }
    }
    async latest(signal) {
        const response = await fetch('https://pypi.org/pypi/pandaai-cli/json', { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), redirect: 'error' });
        if (!response.ok)
            throw new Error('无法检查因子 CLI 版本。');
        const version = record(record(await response.json()).info).version;
        if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version))
            throw new Error('因子 CLI 版本信息无效。');
        return version;
    }
    async install(runtime, version, signal) {
        if (!['win32', 'darwin'].includes(process.platform))
            throw new Error('因子比赛首版支持 Windows 和 macOS 本机运行。');
        if (!/^\d+\.\d+\.\d+$/.test(version))
            throw new Error('CLI 版本无效。');
        runtime = factorRuntimeDirectory(runtime);
        await mkdir(runtime, { recursive: true, mode: 0o700 });
        let python;
        for (const name of process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']) {
            try {
                const path = await this.processes().resolveExecutable(name, undefined, signal);
                await this.process([path, '-c', 'import sys; assert sys.version_info >= (3, 10); print("ok")'], runtime, signal);
                python = path;
                break;
            }
            catch {
                signal.throwIfAborted();
            }
        }
        if (!python)
            throw new Error('请安装 Python 3.10 或更新版本后重试；应用会自动准备独立的因子 CLI。');
        try {
            await this.process([python, '-m', 'venv', runtime], runtime, signal, 120_000);
        }
        catch (error) {
            signal.throwIfAborted();
            throw new Error('因子 CLI 的独立 Python 环境创建失败，请检查安装目录权限和路径长度。', { cause: error });
        }
        await this.process([this.python(runtime), '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
            '--index-url', 'https://pypi.org/simple', `pandaai-cli==${version}`], runtime, signal, 240_000);
        const installed = await this.process([this.python(runtime), '-c', 'import importlib.metadata; print(importlib.metadata.version("pandaai-cli"))'], runtime, signal);
        if (installed !== version)
            throw new Error('因子 CLI 安装版本不一致。');
        return installed;
    }
    async json(url, signal, options = {}) {
        const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
        const text = await response.text();
        if (text.length > 4 * 1024 * 1024)
            throw new Error('平台响应过大。');
        let body;
        try {
            body = record(JSON.parse(text));
        }
        catch {
            throw new Error('平台返回格式异常，请稍后核对状态。');
        }
        if (!response.ok || !['200', '0'].includes(String(body.code))) {
            const code = response.status === 401 || response.status === 403 ? 'LOGIN_REQUIRED' : String(body.code ?? `HTTP_${response.status}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
            throw new FactorApiError(code, response.status >= 400 && response.status < 500);
        }
        return body.data ?? null;
    }
    async login(credentials, signal) {
        // Same password protocol as pandaai-cli/auth.py; no password in argv, logs or model context.
        const token = await this.json(`${GATEWAY}/login/pw`, signal, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: credentials.phone, password: createHash('md5').update(credentials.password).digest('hex'), countryCode: '86' }) });
        if (typeof token !== 'string' || !token)
            throw new FactorApiError('LOGIN_FAILED');
        const user = record(await this.json(`${GATEWAY}/user/info`, signal, { headers: { Authorization: token } }));
        if (!user.id)
            throw new FactorApiError('LOGIN_FAILED');
        signal.throwIfAborted();
        await writeFileAtomic(this.configPath(), JSON.stringify({ gateway_url: GATEWAY, token, uid: String(user.id) }), { mode: 0o600, dirMode: 0o700 });
        return String(user.id);
    }
    async auth() {
        let body;
        try {
            body = record(JSON.parse(await readFile(this.configPath(), 'utf8')));
        }
        catch {
            throw new FactorApiError('LOGIN_REQUIRED');
        }
        if (typeof body.token !== 'string' || typeof body.uid !== 'string' || body.gateway_url !== GATEWAY)
            throw new FactorApiError('LOGIN_REQUIRED');
        return { token: body.token, uid: body.uid };
    }
    async identity(signal) {
        const auth = await this.auth();
        const user = record(await this.json(`${GATEWAY}/user/info`, signal, { headers: { Authorization: auth.token } }));
        if (!user.id || String(user.id) !== auth.uid)
            throw new FactorApiError('LOGIN_REQUIRED');
        return auth.uid;
    }
    async logout() { await rm(this.configPath(), { force: true }); }
    async cli(runtime, args, signal) {
        const compact = factorRuntimeDirectory(runtime);
        if (compact !== runtime) {
            // Previously installed versions may still live in the original directory.
            try {
                await access(this.python(compact));
                runtime = compact;
            }
            catch { /* retain the legacy runtime */ }
        }
        const text = await this.process([this.python(runtime), '-m', 'cli', '--config', this.configPath(), '--json', ...args], runtime, signal, args[0] === 'factor_run' ? 720_000 : 90_000);
        let body;
        try {
            body = record(JSON.parse(text));
        }
        catch {
            throw new Error('因子 CLI 返回格式异常，请核对运行记录，勿重复启动。');
        }
        if (body.success !== true && args[0] !== 'factor_run')
            throw new FactorApiError(String(record(body.error).type ?? 'CLI_FAILED').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60));
        // Error strings may contain request details or code: do not relay raw upstream errors.
        if (body.success !== true)
            body.error = { type: String(record(body.error).type ?? 'RUN_FAILED') };
        return record(safeData(body));
    }
    async arena(path, signal, mutation) {
        if (!/^\/(factorPool|factorArena)\/[A-Za-z0-9_/?=&.-]+$/.test(path))
            throw new Error('无效赛事接口。');
        const { token } = await this.auth();
        return safeData(await this.json(`${ARENA}${path}`, signal, { headers: { Authorization: token, 'Content-Type': 'application/json',
                ...(mutation ? { 'Idempotency-Key': mutation.key } : {}) },
            ...(mutation ? { method: mutation.method, ...(mutation.body === undefined ? {} : { body: JSON.stringify(mutation.body) }) } : {}),
        }));
    }
}
//# sourceMappingURL=factor-contest-cli.js.map