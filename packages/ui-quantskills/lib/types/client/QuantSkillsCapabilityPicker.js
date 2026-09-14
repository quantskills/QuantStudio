import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { agentLibrarySource, skillLibraryAssets } from "./capability-library.js";
import { EXPERT_PRESETS, PRESET_GROUPS, findPresetExpert } from "./expert-presets.js";
import { TEAM_PRESETS, findPresetTeam } from "./team-presets.js";
import pickerCss from './CapabilityLibraryPicker.module.css';
import { CapabilityIcon } from "./CapabilityIcon.js";
/** Session-resident QuantSkills chips and the taxonomy/frequent capability picker. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createSnapshotStore, } from '@deepseek-ai/dsh-client-store';
import { CheckIcon as Check, PlusIcon as Plus, SlidersHorizontalIcon as Sliders, XIcon as X, StackIcon, } from '@phosphor-icons/react';
import css from './QuantSkillsApp.module.css';
/** Small controller that opens the session-scoped picker without touching draft text. */
export class QuantSkillsCapabilityPickerController {
    source = createSnapshotStore({
        open: false,
        mode: 'catalog',
    });
    /** Open one root view for the addressed Session. */
    open(sessionId, mode) {
        this.source.set({ open: true, sessionId, mode });
    }
    /** Close the picker while retaining its last root for a stable next open. */
    close() {
        const current = this.source.getSnapshot();
        if (!current.open)
            return;
        this.source.set({ ...current, open: false });
    }
}
/** Register the two top-level ability rows shown before composer commands. */
export function quantSkillsLauncherSource(picker, attachments) {
    return {
        trigger: '/',
        name: 'quantskills',
        launcher: true,
        order: -20,
        showGroupTitle: false,
        candidates: (_session, request) => Promise.resolve(request.query === ''
            ? Object.freeze([
                Object.freeze({
                    name: '文件',
                    description: '从本机添加到当前会话',
                    icon: 'file',
                    value: 'attachment',
                    section: '添加',
                }),
                Object.freeze({
                    name: 'QuantSkills',
                    description: '选择技能、专家或专家团',
                    icon: 'folder',
                    value: 'catalog',
                    section: '能力',
                }),
                Object.freeze({
                    name: '常用',
                    description: '常用技能、专家与专家团',
                    icon: 'session',
                    value: 'frequent',
                    section: '能力',
                }),
            ])
            : Object.freeze([])),
        onPick: ({ candidate, session }) => {
            if (candidate.value === 'attachment') {
                return attachments.open(session.sessionId) ? 'handled' : undefined;
            }
            const mode = candidate.value;
            if (mode !== 'catalog' && mode !== 'frequent')
                return undefined;
            picker.open(session.sessionId, mode);
            return 'handled';
        },
    };
}
function useObservableSnapshot(source) {
    return useSyncExternalStore(listener => source.subscribe(listener), () => source.getSnapshot());
}
/** Resolve legacy imported 专家 IDs to the current catalog title without replacing user names. */
function presentAgent(definition, assets) {
    const sourceAssetId = definition.sourceVersionId?.split('@', 1)[0];
    const sourceAsset = assets.find(asset => asset.name === sourceAssetId);
    return {
        displayName: sourceAsset !== undefined && definition.name === sourceAsset.name
            ? sourceAsset.title
            : definition.name,
        ...(sourceAsset === undefined ? {} : { sourceAsset }),
    };
}
const SOURCE_LABELS = { mine: '我创建的', recommended: '推荐的', installed: '已安装', discover: '发现的', frequent: '常用' };
const KIND_LABELS = { all: '全部', skill: '技能', agent: '专家', 'agent-team': '专家团' };
/** Local provenance and public recommendations remain separate, including private-only skills. */
export function capabilityLibraryRows(source, catalog, agents, sessions) {
    const assetRow = (asset) => ({ id: `asset:${asset.name}`, kind: asset.projectType, name: asset.title, description: asset.summary || asset.description || asset.name, category: asset.category || 'custom', subcategory: asset.subcategory, asset });
    const expertRow = (expert) => ({ id: `agent:${expert.agentId}`, kind: 'agent', name: presentAgent(expert, catalog.assets).displayName, description: expert.role.replace(/<!--[^]*?-->/g, '').split('\n').find(line => line.trim()) || `${expert.skills.length} 个技能`, category: EXPERT_PRESETS.find(preset => findPresetExpert(preset, [expert]))?.group ?? 'custom', expert });
    const teamRow = (team) => ({ id: `team:${team.teamId}`, kind: 'agent-team', name: team.name, description: team.description.replace(/<!--[^]*?-->/g, '').split('\n').find(line => line.trim()) || `${team.members.length + 1} 位专家协作`, category: TEAM_PRESETS.find(preset => findPresetTeam(preset, [team]))?.group ?? 'custom', team });
    const sourceFor = (id, version) => agentLibrarySource(id, version, agents.librarySources ?? [], catalog);
    if (source === 'discover')
        return catalog.assets.map(assetRow);
    if (source === 'recommended') {
        const recommendedSkills = new Set(EXPERT_PRESETS.flatMap(preset => preset.skills));
        return [
            ...catalog.assets.filter(asset => asset.projectType === 'skill' && recommendedSkills.has(asset.name)).map(assetRow),
            ...EXPERT_PRESETS.map(preset => ({ id: `expert-preset:${preset.id}`, kind: 'agent', name: preset.name, description: preset.summary, category: preset.group, expertPreset: preset })),
            ...TEAM_PRESETS.map(preset => ({ id: `team-preset:${preset.id}`, kind: 'agent-team', name: preset.name, description: preset.summary, category: preset.group, teamPreset: preset })),
        ];
    }
    if (source === 'frequent') {
        const available = [...skillLibraryAssets(catalog, 'mine'), ...skillLibraryAssets(catalog, 'installed'), ...catalog.assets];
        return [
            ...sessions.frequent.flatMap(item => { const asset = available.find(asset => asset.name === item.assetId && asset.projectType === 'skill'); return asset ? [assetRow(asset)] : []; }),
            ...agents.definitions.filter(expert => agents.archives.some(item => item.agent.agentId === expert.agentId)).map(expertRow),
            ...agents.teams.filter(team => agents.teamArchives.some(item => item.team.teamId === team.teamId)).map(teamRow),
        ];
    }
    return [
        ...skillLibraryAssets(catalog, source).map(assetRow),
        ...agents.definitions.filter(expert => sourceFor(expert.agentId, expert.sourceVersionId) === source).map(expertRow),
        ...agents.teams.filter(team => sourceFor(team.teamId) === source).map(teamRow),
    ];
}
/** Search and filter every capability without changing the current draft. */
export function QuantSkillsCapabilityPicker({ sessionId, useProjection, picker, catalog, sessions, agents, close, toggleSkill, openCatalogAgent, openUserAgent, openUserTeam, openExpertPreset, openTeamPreset, }) {
    const pickerState = useObservableSnapshot(picker), catalogState = useObservableSnapshot(catalog);
    const sessionsState = useObservableSnapshot(sessions), agentsState = useObservableSnapshot(agents);
    const resident = useProjection('quantSkillsResidentSkills') ?? [];
    const rootRef = useRef(null), searchRef = useRef(null), locked = useRef(false);
    const [source, setSource] = useState('mine'), [kind, setKind] = useState('all');
    const [category, setCategory] = useState('all'), [subcategory, setSubcategory] = useState('all'), [query, setQuery] = useState('');
    const [busyId, setBusyId] = useState(), [error, setError] = useState();
    const visible = pickerState.open && pickerState.sessionId === sessionId;
    useEffect(() => {
        if (!visible)
            return;
        setSource(pickerState.mode === 'frequent' ? 'frequent' : 'mine');
        setKind('all');
        setCategory('all');
        setSubcategory('all');
        setQuery('');
        setError(undefined);
        const dialog = rootRef.current, previous = document.activeElement;
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
        else
            dialog.setAttribute('open', '');
        searchRef.current?.focus();
        const escape = (event) => { if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } };
        dialog.addEventListener('keydown', escape);
        return () => { dialog.removeEventListener('keydown', escape); dialog.close?.(); if (previous instanceof HTMLElement && previous.isConnected)
            previous.focus(); };
    }, [visible, pickerState.mode, close]);
    const rows = useMemo(() => capabilityLibraryRows(source, catalogState, agentsState, sessionsState), [source, catalogState, agentsState, sessionsState]);
    const typedRows = rows.filter(row => kind === 'all' || row.kind === kind);
    const categories = [...new Set(typedRows.map(row => row.category))];
    const categoryLabel = (id) => catalogState.categories.find(item => item.id === id)?.label ?? PRESET_GROUPS[id] ?? '自定义';
    const selectedCategory = catalogState.categories.find(item => item.id === category);
    const filtered = typedRows.filter(row => (category === 'all' || row.category === category)
        && (subcategory === 'all' || row.subcategory === subcategory)
        && `${row.name} ${row.description} ${row.asset?.name ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const loading = source === 'discover' ? catalogState.phase === 'loading' : source !== 'recommended' && (agentsState.phase === 'loading' || catalogState.installedPhase === 'loading');
    const sourceError = source === 'discover' ? catalogState.catalogError : source !== 'recommended' ? agentsState.error ?? catalogState.installedError : undefined;
    if (!visible)
        return null;
    const invoke = async (row) => {
        if (locked.current)
            return;
        locked.current = true;
        setBusyId(row.id);
        setError(undefined);
        try {
            if (row.asset) {
                if (row.asset.projectType === 'skill')
                    await toggleSkill(sessionId, row.asset, resident.find(binding => binding.assetId === row.asset.name));
                else
                    await openCatalogAgent(row.asset);
            }
            else if (row.expert)
                await openUserAgent(row.expert);
            else if (row.team)
                await openUserTeam(row.team);
            else if (row.expertPreset)
                await openExpertPreset(row.expertPreset);
            else if (row.teamPreset)
                await openTeamPreset(row.teamPreset);
            close();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : '操作失败，请重试。');
        }
        finally {
            locked.current = false;
            setBusyId(undefined);
        }
    };
    const changeSource = (next) => { setSource(next); setCategory('all'); setSubcategory('all'); setError(undefined); };
    return createPortal(_jsxs("dialog", { ref: rootRef, className: pickerCss.dialog, "aria-label": "QuantSkills \u80FD\u529B\u9009\u62E9\u5668", onCancel: event => { event.preventDefault(); close(); }, onClick: event => {
            if (event.target !== event.currentTarget)
                return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
                close();
        }, children: [_jsxs("header", { className: pickerCss.header, children: [_jsxs("div", { children: [_jsx("h2", { children: "\u9009\u62E9\u80FD\u529B" }), _jsx("p", { children: "\u6280\u80FD\u52A0\u8F7D\u5230\u5F53\u524D\u4F1A\u8BDD\uFF0C\u4E13\u5BB6\u4E0E\u4E13\u5BB6\u56E2\u5F00\u542F\u72EC\u7ACB\u4F1A\u8BDD\u3002" })] }), _jsx("button", { type: "button", "aria-label": "\u5173\u95ED QuantSkills \u83DC\u5355", onClick: close, children: _jsx(X, { size: 20 }) })] }), _jsx("div", { className: pickerCss.sources, role: "group", "aria-label": "\u80FD\u529B\u6765\u6E90", children: Object.keys(SOURCE_LABELS).map(id => _jsx("button", { type: "button", "aria-pressed": source === id, onClick: () => changeSource(id), children: SOURCE_LABELS[id] }, id)) }), _jsx("div", { className: pickerCss.kinds, role: "group", "aria-label": "\u80FD\u529B\u7C7B\u578B", children: Object.keys(KIND_LABELS).map(id => _jsxs("button", { type: "button", "aria-pressed": kind === id, onClick: () => { setKind(id); setCategory('all'); setSubcategory('all'); }, children: [KIND_LABELS[id], " ", _jsx("span", { children: rows.filter(row => id === 'all' || row.kind === id).length })] }, id)) }), _jsxs("div", { className: pickerCss.filters, children: [_jsx("input", { ref: searchRef, type: "search", "aria-label": "\u641C\u7D22\u80FD\u529B", placeholder: "\u641C\u7D22\u540D\u79F0\u3001\u7528\u9014\u6216\u5173\u952E\u8BCD", value: query, onChange: event => setQuery(event.target.value) }), _jsxs("select", { "aria-label": "\u80FD\u529B\u5206\u7C7B", value: category, onChange: event => { setCategory(event.target.value); setSubcategory('all'); }, children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5206\u7C7B" }), categories.map(id => _jsx("option", { value: id, children: categoryLabel(id) }, id))] }), !!selectedCategory?.subcategories.length && _jsxs("select", { "aria-label": "\u80FD\u529B\u5B50\u5206\u7C7B", value: subcategory, onChange: event => setSubcategory(event.target.value), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5B50\u5206\u7C7B" }), selectedCategory.subcategories.map(item => _jsx("option", { value: item.id, children: item.label }, item.id))] })] }), _jsxs("section", { className: pickerCss.results, "aria-label": "\u5177\u4F53\u80FD\u529B", "aria-busy": !!busyId, children: [filtered.map(row => {
                        const attached = row.kind === 'skill' && resident.some(binding => binding.assetId === row.asset?.name);
                        return _jsxs("button", { type: "button", className: pickerCss.result, disabled: !!busyId, onClick: () => void invoke(row), children: [_jsx(CapabilityIcon, { kind: row.kind, size: 23 }), _jsxs("span", { className: pickerCss.copy, children: [_jsx("strong", { children: row.name }), _jsx("span", { children: row.description }), _jsxs("small", { children: [KIND_LABELS[row.kind], " \u00B7 ", categoryLabel(row.category), attached ? ' · 已加载' : ''] })] }), _jsx("span", { className: pickerCss.action, children: busyId === row.id ? '正在准备…' : attached ? _jsxs(_Fragment, { children: [_jsx(Check, { size: 14 }), "\u79FB\u9664"] }) : row.kind === 'skill' ? '加载' : row.kind === 'agent-team' ? '开始团队会话' : '开始对话' })] }, row.id);
                    }), loading && !filtered.length && _jsx("p", { className: pickerCss.empty, role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u80FD\u529B\u5E93\u2026" }), !loading && !filtered.length && _jsxs("div", { className: pickerCss.empty, children: [_jsx("strong", { children: query.trim() ? '没有找到匹配的能力' : source === 'discover' && kind === 'agent-team' ? '公开目录暂未提供专家团' : '这里还没有可选能力' }), _jsx("p", { children: query.trim() ? '试试其他名称或关键词。' : source === 'mine' ? '你创建的技能、专家和专家团会显示在这里，也可以先使用推荐能力。' : source === 'discover' && kind === 'agent-team' ? '可以从推荐专家团开始，或使用你创建的专家团。' : '切换来源或分类，查看更多能力。' }), !query.trim() && source !== 'recommended' && _jsx("button", { type: "button", onClick: () => changeSource('recommended'), children: "\u67E5\u770B\u63A8\u8350" })] })] }), (error || sourceError) && _jsx("p", { className: pickerCss.error, role: "alert", children: error || sourceError }), _jsxs("footer", { className: pickerCss.footer, children: [_jsxs("span", { children: [SOURCE_LABELS[source], " \u00B7 ", filtered.length, " \u9879"] }), _jsx("span", { children: source === 'recommended' ? '首次使用会保存专家配置；已有配置会复用。' : source === 'discover' ? '未安装的能力会先安装，再打开。' : '当前输入内容会保留。' })] })] }), document.body);
}
function promptFormStatus(form) {
    const promptForm = form?.promptForm;
    if (promptForm === undefined)
        return '';
    if (promptForm.status === 'invalid')
        return ' · 参数不可用';
    if ((promptForm.adaptations?.length ?? 0) > 0)
        return ' · 已兼容旧格式';
    return '';
}
/** Show the Session's resident 专家 and 技能 set with one-click 技能 removal. */
export function QuantSkillsResidentControl({ sessionId, useProjection, catalog, detach, openPicker, listPromptForms, renderPromptForm, fillDraft, runPrompt, }) {
    const resident = useProjection('quantSkillsResidentSkills') ?? [];
    const agent = useProjection('quantSkillsAgentSession');
    const attachments = useProjection('quantSkillsAttachments') ?? [];
    const catalogState = useObservableSnapshot(catalog);
    const agentDisplayName = agent == null ? undefined : presentAgent(agent, catalogState.assets).displayName;
    const [busy, setBusy] = useState();
    const [open, setOpen] = useState(false);
    const [parameterOpen, setParameterOpen] = useState(false);
    const [forms, setForms] = useState([]);
    const [formsLoading, setFormsLoading] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState();
    const [task, setTask] = useState('');
    const [values, setValues] = useState({});
    const [error, setError] = useState();
    const rootRef = useRef(null);
    const residentKey = resident.map(binding => binding.versionId).join('|');
    const agentKey = agent == null ? '' : `${agent.agentId}:${String(agent.revision)}:${agent.sourceVersionId ?? ''}`;
    const selectedForm = forms.find(form => form.versionId === selectedVersionId);
    const readyForms = forms.filter(form => form.promptForm.status === 'ready');
    useEffect(() => {
        if (!open && !parameterOpen)
            return;
        const dismiss = (event) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
                setOpen(false);
                setParameterOpen(false);
            }
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
                setParameterOpen(false);
            }
        };
        document.addEventListener('pointerdown', dismiss, true);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', dismiss, true);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, parameterOpen]);
    useEffect(() => {
        if (!open && !parameterOpen)
            return;
        let current = true;
        setFormsLoading(true);
        void listPromptForms(sessionId).then((result) => {
            if (!current)
                return;
            setForms(result.forms);
            setSelectedVersionId(selected => result.forms.some(form => form.versionId === selected)
                ? selected
                : (result.forms.find(form => form.promptForm.status === 'ready') ?? result.forms[0])?.versionId);
            setError(undefined);
        }).catch((reason) => {
            if (current)
                setError(reason instanceof Error ? reason.message : '无法读取参数表单');
        }).finally(() => {
            if (current)
                setFormsLoading(false);
        });
        return () => { current = false; };
    }, [open, parameterOpen, sessionId, residentKey, agentKey, listPromptForms]);
    useEffect(() => {
        const selected = forms.find(form => form.versionId === selectedVersionId);
        if (selected?.promptForm.status !== 'ready') {
            setTask('');
            setValues({});
            return;
        }
        setTask('');
        setValues(Object.fromEntries(selected.promptForm.form.fields.map(field => [
            field.key,
            field.default === undefined ? '' : String(field.default),
        ])));
    }, [selectedVersionId, sessionId]);
    const capabilityCount = resident.length + (agent == null ? 0 : 1);
    const formLabel = (form) => catalogState.assets
        .find(asset => asset.name === form.assetId)?.title ?? form.assetId;
    const invokeForm = async (action) => {
        if (selectedForm?.promptForm.status !== 'ready')
            return;
        setBusy(`form:${action}`);
        setError(undefined);
        try {
            const text = await renderPromptForm({
                sessionId,
                versionId: selectedForm.versionId,
                task,
                values,
            });
            if (action === 'run')
                runPrompt(sessionId, text);
            else
                fillDraft(sessionId, text);
            setParameterOpen(false);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : '参数渲染失败');
        }
        finally {
            setBusy(undefined);
        }
    };
    return (_jsxs("div", { ref: rootRef, className: css.residentCapabilities, children: [_jsxs("button", { type: "button", className: css.residentCapabilitySummary, "aria-label": `本会话已加载 ${String(capabilityCount)} 项能力`, title: `已加载 ${String(capabilityCount)} 项能力 · 点击管理`, "aria-haspopup": "dialog", "aria-expanded": open || parameterOpen, onClick: () => { setOpen(value => !value); setParameterOpen(false); setError(undefined); }, children: [_jsx(StackIcon, { size: 20, weight: "duotone", "aria-hidden": "true" }), _jsx("b", { "aria-hidden": "true", "data-empty": capabilityCount === 0 || undefined, children: capabilityCount > 99 ? '99+' : capabilityCount })] }), open && _jsxs("section", { className: css.residentCapabilityMenu, role: "dialog", "aria-label": "\u672C\u4F1A\u8BDD\u5DF2\u52A0\u8F7D\u80FD\u529B", children: [_jsx("header", { children: _jsxs("span", { children: [_jsx("b", { children: "\u672C\u4F1A\u8BDD\u80FD\u529B" }), _jsx("small", { children: "\u5E38\u9A7B\u5F53\u524D\u4E0A\u4E0B\u6587\uFF0C\u53EF\u968F\u65F6\u70ED\u63D2\u62D4 \u6280\u80FD" })] }) }), _jsxs("div", { children: [resident.length === 0 && agent == null && _jsx("p", { className: css.residentCapabilityEmpty, children: "\u5F53\u524D\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u52A0\u8F7D \u6280\u80FD \u6216 \u4E13\u5BB6\u3002" }), agent != null && _jsxs("article", { title: `专家 版本 ${String(agent.revision)}`, children: [_jsx("span", { className: css.residentCapabilityIcon, children: _jsx(CapabilityIcon, { kind: "agent", size: 15, bare: true }) }), _jsxs("span", { children: [_jsx("b", { children: agentDisplayName }), _jsxs("small", { children: ["\u4F1A\u8BDD\u4E13\u5BB6 \u00B7 \u968F\u4F1A\u8BDD\u56FA\u5B9A", promptFormStatus(forms.find(form => form.versionId === agent.sourceVersionId))] })] })] }), resident.map((binding) => {
                                const label = catalogState.assets.find(asset => asset.name === binding.assetId)?.title ?? binding.assetId;
                                const form = forms.find(candidate => candidate.versionId === binding.versionId);
                                return _jsxs("article", { title: `${binding.assetId} · ${binding.commit.slice(0, 12)}`, children: [_jsx("span", { className: css.residentCapabilityIcon, children: _jsx(CapabilityIcon, { kind: "skill", size: 15, bare: true }) }), _jsxs("span", { children: [_jsx("b", { children: label }), _jsxs("small", { children: [binding.assetId, promptFormStatus(form)] })] }), _jsxs("button", { type: "button", "aria-label": `卸载 ${label}`, disabled: busy === binding.assetId, onClick: () => {
                                                setBusy(binding.assetId);
                                                setError(undefined);
                                                void detach(sessionId, binding.assetId).catch((reason) => {
                                                    setError(reason instanceof Error ? reason.message : '无法卸载 技能');
                                                }).finally(() => { setBusy(undefined); });
                                            }, children: [_jsx(X, { size: 13 }), _jsx("span", { children: busy === binding.assetId ? '处理中' : '移除' })] })] }, binding.versionId);
                            })] }), _jsxs("footer", { children: [error !== undefined && _jsx("small", { role: "alert", children: error }), readyForms.length > 0 && _jsxs("button", { type: "button", onClick: () => {
                                    setSelectedVersionId(selected => readyForms.some(form => form.versionId === selected)
                                        ? selected
                                        : readyForms[0]?.versionId);
                                    setOpen(false);
                                    setParameterOpen(true);
                                    setError(undefined);
                                }, children: [_jsx(Sliders, { size: 14 }), "\u53C2\u6570"] }), _jsxs("button", { type: "button", onClick: () => { setOpen(false); openPicker(sessionId); }, children: [_jsx(Plus, { size: 14 }), "\u6DFB\u52A0\u6280\u80FD\u3001\u4E13\u5BB6\u6216\u4E13\u5BB6\u56E2"] })] })] }), parameterOpen && _jsxs("section", { className: css.promptFormDrawer, role: "dialog", "aria-label": "QuantSkills \u53C2\u6570", children: [_jsxs("header", { children: [_jsxs("span", { children: [_jsx("b", { children: "\u53C2\u6570" }), _jsx("small", { children: "\u53EF\u9009\u5FEB\u6377\u8F93\u5165\uFF1B\u81EA\u7136\u8BED\u8A00\u5BF9\u8BDD\u4ECD\u53EF\u76F4\u63A5\u4F7F\u7528\u80FD\u529B" })] }), _jsx("button", { type: "button", "aria-label": "\u5173\u95ED\u53C2\u6570\u9762\u677F", onClick: () => { setParameterOpen(false); }, children: _jsx(X, { size: 15 }) })] }), _jsxs("div", { className: css.promptFormBody, children: [formsLoading && _jsx("p", { className: css.promptFormHint, children: "\u6B63\u5728\u8BFB\u53D6\u5F53\u524D\u4F1A\u8BDD\u53C2\u6570\u2026" }), !formsLoading && forms.length > 1 && _jsxs("label", { className: css.promptFormField, children: [_jsx("span", { children: "\u80FD\u529B" }), _jsx("select", { "aria-label": "\u53C2\u6570\u80FD\u529B", value: selectedVersionId ?? '', onChange: (event) => { setSelectedVersionId(event.target.value); }, children: forms.map(form => _jsxs("option", { value: form.versionId, children: [formLabel(form), form.promptForm.status === 'invalid' ? '（参数不可用）' : ''] }, form.versionId)) })] }), selectedForm?.promptForm.status === 'invalid' && _jsxs("div", { className: css.promptFormInvalid, role: "alert", children: [_jsx("b", { children: "\u53C2\u6570\u4E0D\u53EF\u7528" }), _jsx("span", { children: selectedForm.promptForm.reason }), _jsx("small", { children: "\u80FD\u529B\u6B63\u6587\u4ECD\u6309\u539F\u6587\u5E38\u9A7B\uFF0C\u53EF\u7EE7\u7EED\u81EA\u7136\u8BED\u8A00\u5BF9\u8BDD\u3002" })] }), selectedForm?.promptForm.status === 'ready' && _jsxs(_Fragment, { children: [(selectedForm.promptForm.adaptations?.length ?? 0) > 0 && _jsx("p", { className: css.promptFormHint, role: "status", children: "\u5DF2\u517C\u5BB9\u65E7\u683C\u5F0F\uFF1A\u6570\u5B57\u53C2\u6570\u9ED8\u8BA4\u503C\u5DF2\u5B89\u5168\u8F6C\u6362\uFF0C\u539F\u59CB\u80FD\u529B\u6587\u4EF6\u672A\u4FEE\u6539\u3002" }), _jsxs("label", { className: css.promptFormField, children: [_jsxs("span", { children: ["\u4EFB\u52A1", selectedForm.promptForm.form.task?.required === true && _jsx("em", { children: "\u5FC5\u586B" })] }), _jsx("textarea", { "aria-label": "\u53C2\u6570\u4EFB\u52A1", value: task, placeholder: selectedForm.promptForm.form.task?.placeholder ?? '描述你希望 AI 完成的任务', onChange: (event) => { setTask(event.target.value); } })] }), selectedForm.promptForm.form.fields.map(field => _jsxs("label", { className: css.promptFormField, children: [_jsxs("span", { children: [field.label, field.required === true && _jsx("em", { children: "\u5FC5\u586B" })] }), field.type === 'textarea'
                                                ? _jsx("textarea", { "aria-label": `参数 ${field.label}`, value: values[field.key] ?? '', placeholder: field.placeholder, onChange: (event) => { setValues(current => ({ ...current, [field.key]: event.target.value })); } })
                                                : field.type === 'select'
                                                    ? _jsxs("select", { "aria-label": `参数 ${field.label}`, value: values[field.key] ?? '', onChange: (event) => { setValues(current => ({ ...current, [field.key]: event.target.value })); }, children: [!field.required && _jsx("option", { value: "", children: "\u4E0D\u6307\u5B9A" }), field.options?.map(option => _jsx("option", { value: option.value, children: option.label }, option.value))] })
                                                    : _jsx("input", { "aria-label": `参数 ${field.label}`, type: field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text', value: values[field.key] ?? '', placeholder: field.placeholder, onChange: (event) => { setValues(current => ({ ...current, [field.key]: event.target.value })); } }), field.help !== undefined && _jsx("small", { children: field.help })] }, field.key)), _jsxs("section", { className: css.promptFormAttachments, "aria-label": "\u5F53\u524D\u9644\u4EF6", children: [_jsxs("span", { children: ["\u9644\u4EF6 ", _jsx("b", { children: attachments.length })] }), attachments.length === 0
                                                ? _jsx("small", { children: "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u9644\u4EF6" })
                                                : _jsx("ul", { children: attachments.map(attachment => _jsx("li", { children: attachment.file.name }, attachment.file.attachmentId)) })] })] }), !formsLoading && forms.length === 0 && _jsx("p", { className: css.promptFormHint, children: "\u5F53\u524D\u52A0\u8F7D\u80FD\u529B\u6CA1\u6709\u58F0\u660E qsh-form\u3002" }), error !== undefined && _jsx("p", { className: css.promptFormError, role: "alert", children: error })] }), selectedForm?.promptForm.status === 'ready' && _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy !== undefined, onClick: () => { void invokeForm('fill'); }, children: "\u586B\u5165\u8F93\u5165\u6846" }), _jsx("button", { type: "button", disabled: busy !== undefined, onClick: () => { void invokeForm('run'); }, children: busy === 'form:run' ? '正在运行…' : '应用并运行' })] })] })] }));
}
//# sourceMappingURL=QuantSkillsCapabilityPicker.js.map