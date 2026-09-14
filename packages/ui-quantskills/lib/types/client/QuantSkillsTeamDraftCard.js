import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CapabilityIcon } from "./CapabilityIcon.js";
import { useMemo, useState } from 'react';
import { CheckCircleIcon as CheckCircle, ChatsCircleIcon as ChatsCircle, PencilSimpleIcon as PencilSimple, WarningCircleIcon as WarningCircle, } from '@phosphor-icons/react';
import css from './QuantSkillsApp.module.css';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseDiagnostic(value) {
    if (!isRecord(value)
        || (value.level !== 'info' && value.level !== 'warning' && value.level !== 'error')
        || typeof value.code !== 'string'
        || typeof value.message !== 'string')
        return undefined;
    return { level: value.level, code: value.code, message: value.message };
}
function parseReference(value) {
    if (!isRecord(value) || typeof value.agentId !== 'string'
        || !Number.isSafeInteger(value.revision) || value.revision < 1)
        return undefined;
    return { agentId: value.agentId, revision: value.revision };
}
function parseModelChoice(value) {
    if (!isRecord(value))
        return undefined;
    if (value.kind === 'default')
        return { kind: 'default' };
    if (value.kind !== 'fixed' || !isRecord(value.selection)
        || typeof value.selection.provider !== 'string' || typeof value.selection.model !== 'string'
        || (value.selection.reasoningEffort !== undefined && typeof value.selection.reasoningEffort !== 'string')) {
        return undefined;
    }
    return {
        kind: 'fixed',
        selection: {
            provider: value.selection.provider,
            model: value.selection.model,
            ...(value.selection.reasoningEffort === undefined ? {} : { reasoningEffort: value.selection.reasoningEffort }),
        },
    };
}
function parseDraft(value) {
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.description !== 'string')
        return undefined;
    const lead = parseReference(value.lead);
    const leadModel = parseModelChoice(value.leadModel);
    if (lead === undefined || leadModel === undefined
        || !Array.isArray(value.members) || !Array.isArray(value.diagnostics))
        return undefined;
    const members = value.members.map((candidate) => {
        if (!isRecord(candidate) || typeof candidate.name !== 'string'
            || typeof candidate.responsibility !== 'string'
            || (candidate.context !== 'fresh' && candidate.context !== 'fork'))
            return undefined;
        const agent = parseReference(candidate.agent);
        const model = parseModelChoice(candidate.model);
        return agent === undefined || model === undefined ? undefined : {
            name: candidate.name,
            responsibility: candidate.responsibility,
            context: candidate.context,
            agent,
            model,
        };
    });
    const diagnostics = value.diagnostics.map(parseDiagnostic);
    if (members.some(member => member === undefined) || diagnostics.some(item => item === undefined))
        return undefined;
    return {
        name: value.name,
        description: value.description,
        lead,
        leadModel,
        members: members,
        diagnostics: diagnostics,
    };
}
function parseToolResult(text) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    if (!isRecord(value))
        return undefined;
    if (value.kind === 'agents' && Array.isArray(value.agents))
        return { kind: 'agents', count: value.agents.length };
    if (value.kind !== 'draft' || typeof value.treeDigest !== 'string' || !Array.isArray(value.diagnostics))
        return undefined;
    const diagnostics = value.diagnostics.map(parseDiagnostic);
    if (diagnostics.some(item => item === undefined))
        return undefined;
    const draft = value.draft === undefined ? undefined : parseDraft(value.draft);
    if (value.draft !== undefined && draft === undefined)
        return undefined;
    return {
        kind: 'draft',
        treeDigest: value.treeDigest,
        ...(draft === undefined ? {} : { draft }),
        diagnostics: diagnostics,
    };
}
function descriptionWithResponsibilities(draft) {
    const responsibilities = draft.members.map(member => `- ${member.name}：${member.responsibility}`).join('\n');
    return `${draft.description.trim()}\n\n成员职责\n${responsibilities}`;
}
function modelChoiceLabel(choice) {
    if (choice.kind === 'default')
        return '跟随会话默认模型';
    return [choice.selection.provider, choice.selection.model, choice.selection.reasoningEffort]
        .filter(value => value !== undefined)
        .join(' · ');
}
function seedFromDraft(draft) {
    return {
        name: draft.name,
        description: descriptionWithResponsibilities(draft),
        leadAgentId: draft.lead.agentId,
        leadModel: draft.leadModel,
        members: draft.members.map(member => ({
            name: member.name,
            agentId: member.agent.agentId,
            context: member.context,
            model: member.model,
        })),
    };
}
/** Confirmation card for one logged `quantskills_team_draft` result. */
export function QuantSkillsTeamDraftCard({ block, callId, sessionId, useAgents, useSessions, commitAuthoring, startAgentTeamSession, openAgentTeamBuilder, focusComposer, }) {
    const definitions = useAgents(state => state.definitions);
    const restored = useSessions((state) => {
        const result = state.byId[sessionId]?.projectionValues
            ?.quantSkillsAuthoringCommits?.find(commit => commit.toolCallId === callId)?.result;
        return result?.kind === 'agent-team' ? result.team : undefined;
    });
    const [busy, setBusy] = useState();
    const [committedNow, setCommittedNow] = useState();
    const saved = committedNow ?? restored;
    const [error, setError] = useState();
    const parsed = useMemo(() => {
        if (!('kind' in block) || block.isError)
            return undefined;
        return parseToolResult(block.content.filter(item => item.type === 'text').map(item => item.text).join(''));
    }, [block]);
    if (!('kind' in block))
        return _jsxs("div", { className: css.teamDraftCompact, children: [_jsx(CapabilityIcon, { kind: "agent-team" }), "\u6B63\u5728\u51C6\u5907 \u4E13\u5BB6\u56E2 \u8349\u6848\u2026"] });
    if (block.isError)
        return _jsxs("div", { className: css.teamDraftCompact, role: "alert", children: [_jsx(WarningCircle, {}), "\u4E13\u5BB6\u56E2 \u8349\u6848\u51C6\u5907\u5931\u8D25\u3002"] });
    if (parsed === undefined)
        return _jsxs("div", { className: css.teamDraftCompact, role: "alert", children: [_jsx(WarningCircle, {}), "Host \u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684 \u4E13\u5BB6\u56E2 \u8349\u6848\u3002"] });
    if (parsed.kind === 'agents')
        return _jsxs("div", { className: css.teamDraftCompact, children: [_jsx(CheckCircle, {}), "\u5DF2\u8BFB\u53D6 ", parsed.count, " \u4E2A\u53EF\u7528\u4E8E\u7F16\u6392\u7684 \u4E13\u5BB6\u3002"] });
    if (parsed.draft === undefined)
        return _jsxs("article", { className: css.teamDraftCard, children: [_jsxs("header", { children: [_jsx(WarningCircle, {}), _jsxs("div", { children: [_jsx("h3", { children: "\u4E13\u5BB6\u56E2 \u8349\u6848\u4E0D\u53EF\u7528" }), _jsx("p", { children: "\u8BF7\u6839\u636E\u8BCA\u65AD\u7EE7\u7EED\u4FEE\u6539\u65B9\u6848\u3002" })] })] }), _jsx("ul", { className: css.teamDraftDiagnostics, children: parsed.diagnostics.map(item => _jsx("li", { "data-level": item.level, children: item.message }, `${item.code}-${item.message}`)) }), _jsxs("button", { type: "button", className: css.outlineButton, onClick: focusComposer, children: [_jsx(PencilSimple, {}), "\u7EE7\u7EED\u4FEE\u6539"] })] });
    const draft = parsed.draft;
    const currentById = new Map(definitions.map(definition => [definition.agentId, definition]));
    const lead = currentById.get(draft.lead.agentId);
    const stale = lead?.revision !== draft.lead.revision || draft.members.some(member => (currentById.get(member.agent.agentId)?.revision !== member.agent.revision));
    const commit = async (start) => {
        setBusy(start ? 'start' : 'save');
        setError(undefined);
        try {
            const committed = saved === undefined ? await commitAuthoring(callId, parsed.treeDigest) : undefined;
            if (committed !== undefined && committed.kind !== 'agent-team') {
                throw new Error('Host 返回了与 专家团 草案不一致的创作结果。');
            }
            const definition = saved ?? committed?.team;
            if (definition === undefined)
                throw new Error('Host 未返回已保存的 专家团。');
            setCommittedNow(definition);
            if (start)
                await startAgentTeamSession(definition);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '专家团 创建失败。');
        }
        finally {
            setBusy(undefined);
        }
    };
    return _jsxs("article", { className: css.teamDraftCard, children: [_jsxs("header", { children: [_jsx(CapabilityIcon, { kind: "agent-team" }), _jsxs("div", { children: [_jsx("h3", { children: draft.name }), _jsx("p", { children: draft.description })] })] }), _jsxs("section", { className: css.teamDraftLead, children: [_jsx("small", { children: "Lead" }), _jsx("b", { children: lead?.name ?? draft.lead.agentId }), _jsxs("span", { children: ["r", draft.lead.revision] }), _jsx("span", { children: modelChoiceLabel(draft.leadModel) })] }), _jsx("div", { className: css.teamDraftMembers, children: draft.members.map((member) => {
                    const definition = currentById.get(member.agent.agentId);
                    return _jsxs("section", { children: [_jsxs("div", { children: [_jsx("b", { children: member.name }), _jsxs("span", { children: [definition?.name ?? member.agent.agentId, " \u00B7 r", member.agent.revision] }), _jsx("span", { children: modelChoiceLabel(member.model) })] }), _jsx("p", { children: member.responsibility })] }, member.name);
                }) }), draft.diagnostics.length > 0 && _jsx("ul", { className: css.teamDraftDiagnostics, children: draft.diagnostics.map(item => _jsx("li", { "data-level": item.level, children: item.message }, `${item.code}-${item.message}`)) }), stale && _jsx("p", { className: css.error, role: "alert", children: "\u4E13\u5BB6 revision \u5DF2\u53D8\u5316\uFF0C\u8BF7\u7EE7\u7EED\u5BF9\u8BDD\u5E76\u91CD\u65B0\u751F\u6210\u8349\u6848\u3002" }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error }), saved !== undefined && _jsxs("p", { className: css.teamDraftSaved, children: [_jsx(CheckCircle, {}), "\u5DF2\u4FDD\u5B58 \u4E13\u5BB6\u56E2\u201C", saved.name, "\u201D\u3002"] }), _jsxs("footer", { className: css.teamDraftActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy !== undefined || stale, onClick: () => { void commit(true); }, children: [_jsx(ChatsCircle, {}), busy === 'start' ? '正在启动…' : '创建并启动团队'] }), _jsx("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined || stale || saved !== undefined, onClick: () => { void commit(false); }, children: busy === 'save' ? '正在保存…' : '仅保存团队' }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined, onClick: () => { openAgentTeamBuilder(seedFromDraft(draft)); }, children: [_jsx(PencilSimple, {}), "\u6253\u5F00\u624B\u52A8\u7F16\u6392"] }), _jsx("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined, onClick: focusComposer, children: "\u7EE7\u7EED\u4FEE\u6539" })] })] });
}
//# sourceMappingURL=QuantSkillsTeamDraftCard.js.map