import { isIP } from 'node:net';
function header(request, name) {
    if (request.headers instanceof Headers)
        return request.headers.get(name) ?? undefined;
    const value = request.headers[name];
    return typeof value === 'string' ? value : undefined;
}
function loopback(address) {
    if (!address)
        return false;
    if (address === '::1')
        return true;
    const ipv4 = address.startsWith('::ffff:') ? address.slice(7) : address;
    return isIP(ipv4) === 4 && ipv4.startsWith('127.');
}
function localAuthority(value) {
    if (!value || !/^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::[1-9]\d{0,4})?$/i.test(value))
        return;
    try {
        const url = new URL(`http://${value}`);
        if (url.hostname === 'localhost' || url.hostname === '[::1]' || loopback(url.hostname))
            return url;
    }
    catch { /* Invalid authority never grants local access. */ }
}
/** Require the actual transport to be local; forwarded headers cannot grant access. */
export function isDirectLocalBrowserRequest(request) {
    const authority = localAuthority(header(request, 'host'));
    if (!authority || !loopback(request.socket?.remoteAddress) || !loopback(request.socket?.localAddress))
        return false;
    if (request.socket?.localPort !== Number(authority.port || 80))
        return false;
    for (const name of ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']) {
        if (request.headers instanceof Headers ? request.headers.has(name) : request.headers[name] !== undefined)
            return false;
    }
    return true;
}
/** Adapt only this Connection instance, retaining DSH's Host/Origin fence and remote authentication. */
export function installLocalBrowserAccess(connection) {
    const prior = {
        requestRejection: Object.getOwnPropertyDescriptor(connection, 'requestRejection'),
        authorizeIndex: Object.getOwnPropertyDescriptor(connection, 'authorizeIndex'),
        authenticatedUrl: Object.getOwnPropertyDescriptor(connection, 'authenticatedUrl'),
    };
    const originalRejection = connection.requestRejection;
    const originalIndex = connection.authorizeIndex;
    const originalUrl = connection.authenticatedUrl;
    const replacements = {
        requestRejection(request) {
            const rejection = originalRejection.call(connection, request);
            return rejection === 401 && isDirectLocalBrowserRequest(request) ? undefined : rejection;
        },
        authorizeIndex(request, response) {
            if (isDirectLocalBrowserRequest(request)) {
                // Index navigation gets the same origin fence as RPC and streaming routes.
                if (originalRejection.call(connection, request) === 403) {
                    response.writeHead(403, { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' });
                    response.end(request.method === 'HEAD' ? undefined : 'forbidden');
                    return false;
                }
                const url = new URL(request.url ?? '/', 'http://localhost');
                if (url.searchParams.has('token')) {
                    url.searchParams.delete('token');
                    response.writeHead(303, { location: `${url.pathname}${url.search}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
                    response.end();
                    return false;
                }
                return true;
            }
            return originalIndex.call(connection, request, response);
        },
        authenticatedUrl(baseUrl) {
            const url = new URL(baseUrl);
            if (url.protocol === 'http:' && !url.username && !url.password && localAuthority(url.host)) {
                url.pathname = '/';
                url.search = '';
                url.hash = '';
                return url.href;
            }
            return originalUrl.call(connection, baseUrl);
        },
    };
    // defineProperty updates the service itself, even when Cordis supplies a context-bound proxy.
    for (const key of Object.keys(replacements)) {
        Object.defineProperty(connection, key, { configurable: true, writable: true, value: replacements[key] });
    }
    return () => {
        for (const key of Object.keys(replacements)) {
            if (Object.getOwnPropertyDescriptor(connection, key)?.value !== replacements[key])
                continue;
            const descriptor = prior[key];
            if (descriptor)
                Object.defineProperty(connection, key, descriptor);
            else
                Reflect.deleteProperty(connection, key);
        }
    };
}
//# sourceMappingURL=local-browser-access.js.map