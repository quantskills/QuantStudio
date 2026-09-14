import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { CheckCircleIcon as CheckCircle, ChatsCircleIcon as ChatsCircle, PencilSimpleIcon as PencilSimple, WarningCircleIcon as WarningCircle, } from '@phosphor-icons/react';
import { CapabilityIcon } from "./CapabilityIcon.js";
import css from './QuantSkillsApp.module.css';
function record(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseResult(text) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    if (!record(value))
        return undefined;
    if (value.kind === 'skills' && Array.isArray(value.skills))
        return { kind: 'skills', count: value.skills.length };
    if (value.kind !== 'draft' || !record(value.draft))
        return undefined;
    const draft = value.draft;
    if (typeof draft.assetId !== 'string'
        || (draft.assetKind !== 'skill' && draft.assetKind !== 'agent')
        || (draft.declaration !== 'SKILL.md' && draft.declaration !== 'AGENTS.md')
        || typeof draft.draftPath !== 'string'
        || typeof draft.treeDigest !== 'string'
        || typeof draft.fileCount !== 'number'
        || typeof draft.totalBytes !== 'number'
        || !Array.isArray(draft.requires)
        || draft.requires.some(item => typeof item !== 'string'))
        return undefined;
    return {
        kind: 'draft',
        draft: {
            assetId: draft.assetId,
            assetKind: draft.assetKind,
            declaration: draft.declaration,
            draftPath: draft.draftPath,
            treeDigest: draft.treeDigest,
            fileCount: draft.fileCount,
            totalBytes: draft.totalBytes,
            requires: draft.requires,
        },
    };
}
/** Explicit confirmation card for one logged local 技能 or 专家 draft. */
export function QuantSkillsAssetDraftCard({ block, callId, sessionId, useSessions, commitAuthoring, startSkill, startAgent, openManualAgent, focusComposer, }) {
    const [busy, setBusy] = useState();
    const restored = useSessions(state => state.byId[sessionId]?.projectionValues
        ?.quantSkillsAuthoringCommits?.find(commit => commit.toolCallId === callId)?.result);
    const [committedNow, setCommittedNow] = useState();
    const saved = committedNow ?? restored;
    const [error, setError] = useState();
    const parsed = useMemo(() => {
        if (!('kind' in block) || block.isError)
            return undefined;
        return parseResult(block.content.filter(item => item.type === 'text').map(item => item.text).join(''));
    }, [block]);
    if (!('kind' in block))
        return _jsxs("div", { className: css.teamDraftCompact, children: [_jsx(CapabilityIcon, { kind: "agent", size: 18, bare: true }), "\u6B63\u5728\u6821\u9A8C\u672C\u5730\u8349\u6848\u2026"] });
    if (block.isError)
        return _jsxs("div", { className: css.teamDraftCompact, role: "alert", children: [_jsx(WarningCircle, {}), "\u672C\u5730\u8349\u6848\u6821\u9A8C\u5931\u8D25\u3002"] });
    if (parsed === undefined)
        return _jsxs("div", { className: css.teamDraftCompact, role: "alert", children: [_jsx(WarningCircle, {}), "Host \u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u521B\u4F5C\u8349\u6848\u3002"] });
    if (parsed.kind === 'skills')
        return _jsxs("div", { className: css.teamDraftCompact, children: [_jsx(CheckCircle, {}), "\u5DF2\u8BFB\u53D6 ", parsed.count, " \u4E2A\u7CBE\u786E \u6280\u80FD \u7248\u672C\u3002"] });
    const draft = parsed.draft;
    const commit = async (start) => {
        setBusy(start ? 'start' : 'save');
        setError(undefined);
        try {
            const result = saved ?? await commitAuthoring(callId, draft.treeDigest);
            if (result.kind !== draft.assetKind)
                throw new Error('Host 返回了与草案类型不一致的创作结果。');
            setCommittedNow(result);
            if (start) {
                if (result.kind === 'skill')
                    await startSkill(result.version);
                else
                    await startAgent(result.agent);
            }
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'QuantSkills 草案保存失败。');
        }
        finally {
            setBusy(undefined);
        }
    };
    return _jsxs("article", { className: css.teamDraftCard, children: [_jsxs("header", { children: [_jsx(CapabilityIcon, { kind: draft.assetKind }), _jsxs("div", { children: [_jsx("h3", { children: saved?.kind === 'agent' ? saved.agent.name : draft.assetId }), _jsxs("p", { children: [draft.assetKind === 'skill' ? '技能' : '专家', " \u00B7 ", draft.fileCount, " \u4E2A\u6587\u4EF6 \u00B7 ", saved ? '已加入我的创建' : '已准备就绪'] })] })] }), _jsxs("details", { className: css.draftTechnical, children: [_jsx("summary", { children: "\u6587\u4EF6\u4E0E\u4F9D\u8D56\u8BE6\u60C5" }), _jsxs("section", { className: css.teamDraftLead, children: [_jsxs("small", { children: ["\u672C\u5730\u79C1\u6709", draft.assetKind === 'skill' ? ' 技能' : ' 专家'] }), _jsx("b", { children: draft.draftPath }), _jsxs("span", { children: [draft.treeDigest.slice(0, 18), "\u2026"] })] }), draft.requires.length > 0 && _jsxs("p", { children: ["\u4F9D\u8D56\u6280\u80FD\uFF1A", draft.requires.join('、')] })] }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error }), saved !== undefined && _jsxs("p", { className: css.teamDraftSaved, children: [_jsx(CheckCircle, {}), "\u5DF2\u4FDD\u5B58\u201C", draft.assetId, "\u201D\u3002"] }), _jsxs("footer", { className: css.teamDraftActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy !== undefined, onClick: () => { void commit(true); }, children: [_jsx(ChatsCircle, {}), busy === 'start' ? '正在启动…' : saved ? '开始使用' : '保存并新建会话'] }), saved === undefined && _jsx("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined, onClick: () => { void commit(false); }, children: busy === 'save' ? '正在保存…' : '保存' }), draft.assetKind === 'agent' && _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined, onClick: () => { openManualAgent(saved?.kind === 'agent' ? saved.agent : undefined); }, children: [_jsx(PencilSimple, {}), "\u6253\u5F00\u624B\u52A8\u914D\u7F6E"] }), _jsx("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined, onClick: focusComposer, children: "\u7EE7\u7EED\u4FEE\u6539" })] })] });
}
//# sourceMappingURL=QuantSkillsAssetDraftCard.js.map