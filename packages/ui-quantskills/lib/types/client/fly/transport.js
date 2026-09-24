let access;
export function connectFlyTransport(value) { access = value; }
export async function flyApi(path, body) {
    if (!access)
        throw new Error('果蝇服务尚未连接');
    return await access.request({ path, ...(body === undefined ? {} : { body: body }) });
}
export async function flyFetch(url, init) {
    const prefix = '/api/fly/v2/';
    if (!url.startsWith(prefix))
        throw new Error('果蝇接口路径无效');
    init?.signal?.throwIfAborted();
    const result = await flyApi(url.slice(prefix.length), typeof init?.body === 'string' ? JSON.parse(init.body) : undefined);
    init?.signal?.throwIfAborted();
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
}
const assets = new Map();
export function flyAsset(version, name) {
    const path = `asset/${version}/${name}`;
    let result = assets.get(path);
    if (!result) {
        result = flyApi(path).then(value => value.url).catch(error => { assets.delete(path); throw error; });
        assets.set(path, result);
    }
    return result;
}
//# sourceMappingURL=transport.js.map