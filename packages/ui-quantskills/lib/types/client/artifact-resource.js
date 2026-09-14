/** Only same-Host, session-scoped artifact URLs may enter media elements. */
export function artifactResourceUrl(path) {
    const base = new URL(window.location.href);
    const url = new URL(path, base);
    if (url.origin !== base.origin || url.pathname !== '/api/quantskills.result.file' || !url.searchParams.get('sessionId') || !url.searchParams.get('path'))
        throw new Error('文件预览地址无效，请重新打开。');
    return url.href;
}
export function artifactDownload(sessionId, path) {
    const query = new URLSearchParams({ sessionId, path, download: '1' });
    const link = document.createElement('a');
    link.href = artifactResourceUrl(`/api/quantskills.result.file?${query}`);
    link.download = path.replaceAll('\\', '/').split('/').at(-1) ?? 'artifact';
    document.body.append(link);
    link.click();
    link.remove();
}
//# sourceMappingURL=artifact-resource.js.map