/** 本机回环回调，只接收 OAuth code，登录页仍在公网 MCP。 */
import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
const SUCCESS_HTML = `<!doctype html><meta charset="utf-8"><title>PandaData</title>
<body style="font-family:sans-serif;padding:48px;line-height:1.5">
<p>授权码已收到。请关闭此窗口，返回 QuantSkills 查看连接状态。</p>
</body>`;
const FAILURE_HTML = `<!doctype html><meta charset="utf-8"><title>PandaData</title>
<body style="font-family:sans-serif;padding:48px;line-height:1.5">
<p>登录未完成。请关闭此窗口后在 QuantSkills 设置中重试。</p>
</body>`;
/**
 * 在 127.0.0.1 随机端口监听 `/callback`。
 */
export async function startOauthLoopback(options = {}) {
    const state = randomUUID();
    let settle;
    const pending = new Promise((resolve) => {
        settle = resolve;
    });
    const server = createServer((request, response) => {
        handleCallback(request, response, state, options.publicOrigin, (result) => {
            settle?.(result);
            settle = undefined;
        });
    });
    await listenLoopback(server, options.port ?? 0);
    const address = server.address();
    if (address === null || typeof address === 'string') {
        server.close();
        throw new Error('PandaData MCP 无法绑定本机回环端口。');
    }
    const redirectUrl = options.publicOrigin === undefined
        ? `http://127.0.0.1:${address.port}/callback`
        : `${options.publicOrigin}/api/quantskills/panda-oauth/callback`;
    return {
        redirectUrl,
        state,
        localCallbackUrl: `http://127.0.0.1:${address.port}/callback`,
        waitForCode: async (signal) => {
            const abort = () => {
                settle?.({ error: new Error('PandaData 登录已取消。') });
                settle = undefined;
            };
            if (signal?.aborted)
                abort();
            signal?.addEventListener('abort', abort, { once: true });
            try {
                const result = await pending;
                if (result.error !== undefined)
                    throw result.error;
                if (result.code === undefined || result.code.length === 0)
                    throw new Error('PandaData 登录未返回授权码。');
                return result.code;
            }
            finally {
                signal?.removeEventListener('abort', abort);
            }
        },
        close: () => closeServer(server),
    };
}
function listenLoopback(server, port) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
}
function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
}
function handleCallback(request, response, state, returnOrigin, done) {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== '/callback') {
        response.writeHead(404).end();
        return;
    }
    const receivedState = Buffer.from(url.searchParams.get('state') ?? '');
    const expectedState = Buffer.from(state);
    if (receivedState.length !== expectedState.length || !timingSafeEqual(receivedState, expectedState)) {
        response.writeHead(403).end('Invalid OAuth state');
        return;
    }
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    if (error !== null || code === null || code.length === 0) {
        response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' }).end(FAILURE_HTML);
        done({ error: new Error('PandaData 登录未完成。') });
        return;
    }
    if (returnOrigin !== undefined)
        response.writeHead(303, { location: returnOrigin + '/', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).end();
    else
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(SUCCESS_HTML);
    done({ code });
}
/** 测试辅助：解析回环地址。 */
export function loopbackPort(server) {
    return server.address().port;
}
//# sourceMappingURL=callback-server.js.map