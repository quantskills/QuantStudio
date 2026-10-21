import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** QS result facts live inside the official dock; file navigation belongs to DSH. */
import { useEffect, useState } from 'react';
import { ArrowClockwise, DownloadSimple, FileText, FolderOpen } from '@phosphor-icons/react';
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { projectQuantSkillsResults } from "./result-data.js";
import { artifactResourceUrl } from "./artifact-resource.js";
import { InteractiveHtml } from "./InteractiveHtml.js";
import css from './NativeResults.module.css';
export function NativeResults({ sessionId, useSession, useSessions, useChat, listFiles, prepareFiles, openFile, openWorkspace, downloadFile }) {
    const running = useSession(state => state.running);
    const title = useSessions(state => state.byId[sessionId]?.displayTitle ?? '本次对话');
    const candidatePaths = useChat(snapshot => JSON.stringify(projectQuantSkillsResults(snapshot).files.map(file => file.path)));
    const [revision, setRevision] = useState(0);
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState('loading');
    const [openFailed, setOpenFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        setFiles([]);
        const paths = JSON.parse(candidatePaths);
        void Promise.all([listFiles(controller.signal), paths.length === 0 ? [] : prepareFiles(paths, controller.signal)]).then(([complete, current]) => {
            const value = [...current, ...complete];
            if (!controller.signal.aborted) {
                setFiles(value);
                setStatus('ready');
            }
        }, () => { if (!controller.signal.aborted)
            setStatus('error'); });
        return () => controller.abort();
    }, [sessionId, listFiles, prepareFiles, candidatePaths, running, revision]);
    const uniqueFiles = [...new Map(files.map(file => [file.path, file])).values()];
    const available = uniqueFiles.filter(file => file.status !== 'unavailable');
    return _jsxs("section", { className: css.results, "aria-label": "\u672C\u5BF9\u8BDD\u7ED3\u679C", children: [_jsxs("header", { className: css.header, children: [_jsxs("div", { children: [_jsx("strong", { children: title }), _jsx("span", { children: running ? '进行中 · 完成后更新文件' : '本对话的交付文件' })] }), _jsx("button", { type: "button", title: "\u5237\u65B0\u7ED3\u679C", "aria-label": "\u5237\u65B0\u7ED3\u679C", onClick: () => setRevision(n => n + 1), children: _jsx(ArrowClockwise, { size: 16 }) }), _jsx("button", { type: "button", title: "\u6D4F\u89C8\u5DE5\u4F5C\u533A", "aria-label": "\u6D4F\u89C8\u5DE5\u4F5C\u533A", onClick: openWorkspace, children: _jsx(FolderOpen, { size: 16 }) })] }), _jsxs("div", { className: css.list, children: [status === 'loading' && _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\u2026" }), status === 'error' && _jsx("p", { role: "alert", children: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u7ED3\u679C\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002" }), status === 'ready' && files.length === 0 && _jsx("p", { children: "\u751F\u6210\u62A5\u544A\u3001\u56FE\u8868\u6216\u6587\u4EF6\u540E\uFF0C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }), uniqueFiles.map(file => _jsxs("div", { className: css.file, children: [_jsxs("button", { type: "button", title: file.path, disabled: file.status === 'unavailable', onClick: () => {
                                    setOpenFailed(false);
                                    try {
                                        openFile(file.path);
                                    }
                                    catch {
                                        setOpenFailed(true);
                                    }
                                }, children: [_jsx(FileText, { size: 18 }), _jsxs("span", { children: [_jsx("b", { children: file.path.replaceAll('\\', '/').split('/').at(-1) }), _jsx("small", { children: file.status === 'unavailable' ? file.reason ?? '文件不可用' : file.path })] })] }), file.status !== 'unavailable' && _jsx("button", { type: "button", title: "\u4E0B\u8F7D\u539F\u6587\u4EF6", "aria-label": `下载 ${file.path}`, onClick: () => downloadFile(file.path), children: _jsx(DownloadSimple, { size: 16 }) })] }, file.path)), openFailed && _jsx("p", { role: "alert", children: "\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u9884\u89C8\uFF0C\u8BF7\u91CD\u8BD5\u3002" })] }), available.length > 0 && _jsx("footer", { className: css.footer, children: _jsxs("span", { children: [available.length, " \u4E2A\u6587\u4EF6"] }) })] });
}
/** Preserve QS media and isolated HTML within the official tab lifecycle. */
export function NativeResultMedia({ useTabInfo, previewFile }) {
    const { tab } = useTabInfo();
    const file = parseFileAddress(tab.contentId);
    const sessionId = file?.scope === 'session' ? file.sessionId : undefined;
    const path = file?.path;
    const [attempt, setAttempt] = useState(0);
    const [media, setMedia] = useState();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let current = true;
        setMedia(undefined);
        setFailed(false);
        if (sessionId === undefined || path === undefined) {
            setFailed(true);
            return;
        }
        void previewFile(sessionId, path).then(value => {
            if (!current)
                return;
            if (value.kind === 'text' && value.mediaType === 'text/html') {
                setMedia({ kind: 'html', source: value.text });
                return;
            }
            if (value.kind !== 'resource' || (value.presentation !== 'video' && value.presentation !== 'audio'))
                throw new Error('Unsupported media');
            setMedia({ kind: value.presentation, url: artifactResourceUrl(value.url) });
        }).catch(() => { if (current)
            setFailed(true); });
        return () => { current = false; };
    }, [sessionId, path, tab.navigation.revision, previewFile, attempt]);
    return _jsxs("section", { className: css.media, "aria-label": "\u6587\u4EF6\u9884\u89C8", children: [_jsxs("header", { className: css.header, children: [_jsx("span", { title: path, children: path }), _jsx("button", { type: "button", "aria-label": "\u5237\u65B0\u9884\u89C8", onClick: () => setAttempt(n => n + 1), children: _jsx(ArrowClockwise, { size: 16 }) })] }), failed ? _jsx("p", { role: "alert", children: "\u6682\u65F6\u65E0\u6CD5\u9884\u89C8\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u3002" }) : !media ? _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\u2026" })
                : media.kind === 'html' ? _jsx(InteractiveHtml, { source: media.source, title: path ?? 'HTML 报告', className: css.html })
                    : media.kind === 'video' ? _jsx("video", { src: media.url, controls: true, playsInline: true, preload: "metadata", onError: () => setFailed(true) }, `${tab.contentId}:${attempt}`)
                        : _jsx("audio", { src: media.url, controls: true, preload: "metadata", onError: () => setFailed(true) }, `${tab.contentId}:${attempt}`)] });
}
//# sourceMappingURL=NativeResults.js.map