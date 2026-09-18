import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { PlusIcon, ArrowLeftIcon, XIcon } from '@phosphor-icons/react';
import css from './QuantSkillsModelServices.module.css';
const stateLabel = { saved: '已保存 · 待验证', verified: '验证通过', failed: '验证失败', 'discovery-unavailable': '已保存 · 需推理验证' };
const MODEL_ID_TEMPLATE = ['your-model-id', 'your-model-id-fast'];
function parseCapabilityProfiles(raw, ids) {
    try {
        const parsed = raw ? JSON.parse(raw) : [];
        if (raw && Array.isArray(parsed))
            return parsed.filter(item => item && typeof item.id === 'string');
    }
    catch { /* keep the guided editor usable while JSON is being edited */ }
    return ids.map(id => ({ id: id.trim(), input: ['text'] })).filter(item => item.id);
}
function profileReasoning(profile) {
    if (profile.reasoningEfforts === false)
        return 'unsupported';
    if (profile.reasoningEfforts && typeof profile.reasoningEfforts === 'object')
        return 'supported';
    return 'unknown';
}
function capabilityTemplate(modelIds, api) {
    const profiles = modelIds.map(id => ({
        id,
        input: ['text'],
        reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high' },
        ...(api === 'openai-completions'
            ? { compat: { supportsReasoningEffort: true } }
            : api === 'anthropic-messages'
                ? { compat: { forceAdaptiveThinking: true } }
                : {}),
    }));
    return JSON.stringify(profiles, null, 2);
}
/** QuantSkills owns this form and its typed Host API; no hidden Host forms are mounted. */
export function QuantSkillsModelServices({ access, initialData, initialAdding = false, onSaved, onBusyChange }) {
    const [data, setData] = useState(initialData);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [adding, setAdding] = useState(initialAdding);
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState();
    const [advancedModels, setAdvancedModels] = useState();
    const [deleteRoute, setDeleteRoute] = useState();
    const [testing, setTesting] = useState();
    const [testModel, setTestModel] = useState('');
    const currentProfiles = parseCapabilityProfiles(advancedModels ?? data?.connections.find(c => c.route === draft?.route)?.modelsJson, draft?.modelIds ?? []);
    const updateProfile = (id, status) => {
        const profiles = currentProfiles.map(profile => {
            if (profile.id !== id)
                return profile;
            const next = { ...profile };
            if (status === 'unknown')
                delete next.reasoningEfforts;
            else if (status === 'unsupported')
                next.reasoningEfforts = false;
            else if (next.reasoningEfforts === undefined || next.reasoningEfforts === false)
                next.reasoningEfforts = { low: 'low' };
            next.compat = { ...(next.compat ?? {}) };
            if (draft?.api === 'openai-completions') {
                if (status === 'unknown')
                    delete next.compat.supportsReasoningEffort;
                else
                    next.compat.supportsReasoningEffort = status === 'supported';
            }
            return next;
        });
        setAdvancedModels(JSON.stringify(profiles, null, 2));
    };
    useEffect(() => {
        let active = true;
        if (access && !initialData)
            void Promise.resolve().then(() => access({ action: 'list' })).then(result => { if (active)
                setData(result); }, () => { if (active)
                setError('无法读取模型服务，请检查 Host 连接。'); });
        return () => { active = false; };
    }, [access, initialData]);
    const run = async (request) => {
        if (!access || busy)
            return;
        if (request.draft)
            request = { ...request, draft: { ...request.draft, modelIds: request.draft.modelIds.map(id => id.trim()).filter(Boolean) } };
        setBusy(true);
        onBusyChange?.(true);
        setError('');
        setMessage('');
        try {
            const result = await access(request);
            setData(result);
            setMessage(result.verification?.message ?? '操作已保存。');
            if (request.action === 'verify' && result.verification?.state === 'verified') {
                setDraft(current => current ? { ...current, modelIds: result.verification.modelIds } : current);
                if (result.verification.modelProfiles)
                    setAdvancedModels(JSON.stringify(result.verification.modelProfiles, null, 2));
            }
            if (request.action === 'save') {
                setDraft(undefined);
                setAdding(false);
                setAdvancedModels(undefined);
                onSaved?.(result);
            }
            if (request.action === 'remove')
                setDeleteRoute(undefined);
            if (request.action === 'test')
                setTesting(undefined);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试。');
        }
        finally {
            setBusy(false);
            onBusyChange?.(false);
        }
    };
    const choose = (service) => {
        setDraft({ service: service.id, name: service.name, baseURL: service.variants[0]?.baseURL ?? '', api: service.api, modelIds: [], auto: false });
        setAdvancedModels(undefined);
        setError('');
        setMessage('');
    };
    const edit = (connection) => {
        setAdding(true);
        setDraft({ route: connection.route, service: connection.service, name: connection.name, baseURL: connection.baseURL, api: connection.api, modelIds: connection.modelIds, auto: connection.auto, ...connection.reasoning === undefined ? {} : { reasoning: connection.reasoning } });
        setAdvancedModels(undefined);
        setError('');
        setMessage('');
    };
    const service = data?.catalog.find(item => item.id === draft?.service);
    const local = draft?.service === 'codex-local';
    return _jsxs("div", { className: css.root, children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("small", { children: "MODEL SERVICES" }), _jsx("h2", { children: "\u6A21\u578B\u670D\u52A1" }), _jsx("p", { children: "\u63A5\u5165\u540E\u5373\u53EF\u5F00\u59CB\u4EFB\u52A1\u3002\u4FDD\u5B58\u540E\u53EF\u5728\u4F1A\u8BDD\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u9009\u62E9\u5177\u4F53\u6A21\u578B\u3002" })] }), !adding && _jsxs("button", { type: "button", disabled: !data || busy, onClick: () => { setAdding(true); setSearch(''); setError(''); setMessage(''); }, children: [_jsx(PlusIcon, {}), "\u6DFB\u52A0\u6A21\u578B\u670D\u52A1"] })] }), error && _jsx("p", { role: "alert", className: css.error, children: error }), message && _jsx("p", { role: "status", children: message }), !access && _jsx("p", { role: "alert", children: "\u6A21\u578B\u63A5\u5165\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5 Host\u3002" }), access && !data && !error && _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u5DF2\u4FDD\u5B58\u7684\u670D\u52A1\u2026" }), adding && _jsxs("section", { className: css.editor, "aria-label": "\u6DFB\u52A0\u6216\u7BA1\u7406\u6A21\u578B\u670D\u52A1", children: [_jsxs("header", { children: [_jsx("button", { type: "button", disabled: busy, "aria-label": "\u8FD4\u56DE\u670D\u52A1\u9009\u62E9", onClick: () => { setDraft(undefined); setAdvancedModels(undefined); }, children: _jsx(ArrowLeftIcon, {}) }), _jsx("h3", { children: draft ? draft.name : '选择模型服务' }), _jsx("button", { type: "button", disabled: busy, "aria-label": "\u5173\u95ED\u6A21\u578B\u670D\u52A1\u8868\u5355", onClick: () => { setAdding(false); setDraft(undefined); setAdvancedModels(undefined); }, children: _jsx(XIcon, {}) })] }), !draft ? _jsxs(_Fragment, { children: [_jsx("input", { "aria-label": "\u641C\u7D22\u6A21\u578B\u670D\u52A1", placeholder: "\u641C\u7D22\u5382\u5546\u6216\u81EA\u5B9A\u4E49\u670D\u52A1", value: search, onChange: event => { setSearch(event.target.value); } }), _jsx("div", { className: css.catalog, children: data?.catalog.filter(item => (item.name + item.id + (item.recommendations?.map(model => model.name).join(' ') ?? '')).toLowerCase().includes(search.toLowerCase())).map(item => _jsxs("button", { type: "button", onClick: () => { choose(item); }, children: [_jsx("b", { children: item.name }), _jsx("small", { children: item.id === 'codex-local' ? '使用本机登录' : item.id === 'custom' ? '兼容网关或本地服务' : `预置支持 · ${item.recommendations?.length ?? 0} 个目录推荐 · 需要自行授权` })] }, item.id)) })] }) : _jsx("form", { onSubmit: event => { event.preventDefault(); void run({ action: 'save', draft: { ...draft, ...(advancedModels === undefined ? {} : { modelsJson: advancedModels }) } }); }, children: _jsxs("fieldset", { disabled: busy, children: [local ? _jsx("p", { children: "\u68C0\u67E5\u672C\u673A Codex \u5B89\u88C5\u3001\u767B\u5F55\u72B6\u6001\u53CA\u53EF\u7528\u6A21\u578B\uFF1B\u4E0D\u8981\u6C42 API \u5BC6\u94A5\uFF0C\u4E0D\u4FEE\u6539\u5168\u5C40 Codex \u914D\u7F6E\u3002" }) : _jsxs(_Fragment, { children: [(service?.variants.length ?? 0) > 1 && _jsxs("label", { children: ["\u670D\u52A1\u533A\u57DF / \u5957\u9910", _jsxs("select", { value: service?.variants.find(v => v.baseURL === draft.baseURL)?.id ?? '', onChange: event => {
                                                        const variant = service?.variants.find(v => v.id === event.target.value);
                                                        if (variant)
                                                            setDraft({ ...draft, baseURL: variant.baseURL, apiKey: '' });
                                                    }, children: [_jsx("option", { value: "", disabled: true, children: "\u81EA\u5B9A\u4E49\u5730\u5740\uFF08\u9AD8\u7EA7\u8BBE\u7F6E\uFF09" }), service?.variants.map(v => _jsx("option", { value: v.id, children: v.name }, v.id))] })] }), draft.service === 'custom' && _jsxs("label", { children: ["\u670D\u52A1\u5730\u5740", _jsx("input", { required: true, type: "url", value: draft.baseURL, placeholder: "https://example.com/v1", onChange: event => { setDraft({ ...draft, baseURL: event.target.value }); } })] }), /^http:/i.test(draft.baseURL.trim()) && _jsx("small", { children: "HTTP \u4F1A\u660E\u6587\u4F20\u8F93 API \u5BC6\u94A5\u548C\u8BF7\u6C42\u5185\u5BB9\uFF1B\u8BF7\u786E\u8BA4\u7F51\u7EDC\u53EF\u4FE1\uFF0C\u516C\u7F51\u670D\u52A1\u5EFA\u8BAE\u4F7F\u7528 HTTPS\u3002" }), _jsxs("label", { children: ["API \u5BC6\u94A5", _jsx("input", { type: "password", autoComplete: "new-password", value: draft.apiKey ?? '', placeholder: draft.route ? '已保存的密钥不回显；输入新值才替换' : draft.service === 'custom' ? '本机无鉴权服务可留空' : '填写厂商提供的 API 密钥', onChange: event => { setDraft({ ...draft, apiKey: event.target.value }); } })] })] }), !!service?.recommendations?.length && _jsxs("section", { className: css.recommendations, "aria-label": "\u76EE\u5F55\u63A8\u8350\u6A21\u578B", children: [_jsx("header", { children: _jsxs("div", { children: [_jsx("b", { children: "\u76EE\u5F55\u63A8\u8350" }), _jsx("small", { children: "\u4EC5\u4F9B\u9009\u578B\u53C2\u8003\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u52A0\u5165\u53EF\u8FD0\u884C\u6A21\u578B" })] }) }), _jsx("div", { children: service.recommendations.map(model => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: model.name }), model.lifecycle === 'experimental' && _jsx("small", { children: "\u5B9E\u9A8C" }), !model.exactId && _jsx("small", { children: "\u7CFB\u5217\u540D" })] }), _jsx("p", { children: model.summary }), _jsx("small", { children: model.roles.join(' · ') })] }, model.name)) }), _jsx("p", { children: "\u8FDE\u63A5\u9A8C\u8BC1\u540E\u53EF\u83B7\u53D6\u53EF\u7528\u6A21\u578B\uFF1B\u63A8\u7406\u6D4B\u8BD5\u53EF\u4EE5\u8FDB\u4E00\u6B65\u786E\u8BA4\u6A21\u578B\u662F\u5426\u80FD\u591F\u6B63\u5E38\u54CD\u5E94\u3002" })] }), !local && _jsxs("label", { children: ["\u9ED8\u8BA4\u601D\u8003\u5F3A\u5EA6", _jsxs("select", { "aria-label": "\u9ED8\u8BA4\u601D\u8003\u5F3A\u5EA6", value: draft.reasoning ?? '', onChange: event => { const value = event.target.value; setDraft({ ...draft, ...(value ? { reasoning: value } : { reasoning: undefined }) }); }, children: [_jsx("option", { value: "", children: "\u81EA\u52A8\uFF08\u6309\u6A21\u578B\u80FD\u529B\uFF09" }), _jsx("option", { value: "off", children: "\u5173\u95ED" }), _jsx("option", { value: "minimal", children: "\u6700\u5C0F" }), _jsx("option", { value: "low", children: "\u4F4E" }), _jsx("option", { value: "medium", children: "\u4E2D" }), _jsx("option", { value: "high", children: "\u9AD8" }), _jsx("option", { value: "xhigh", children: "\u5F88\u9AD8" }), _jsx("option", { value: "max", children: "\u6700\u5927" })] }), _jsx("small", { children: "\u8FD9\u662F\u670D\u52A1\u8DEF\u7531\u7684\u9ED8\u8BA4\u503C\uFF1B\u4EC5\u9009\u62E9\u6A21\u578B\u80FD\u529B\u4E2D\u786E\u5B9E\u58F0\u660E\u652F\u6301\u7684\u5F3A\u5EA6\u3002\u7559\u7A7A\u7531\u6A21\u578B\u81EA\u8EAB\u9ED8\u8BA4\u503C\u51B3\u5B9A\u3002" })] }), _jsx("div", { className: css.actions, children: _jsx("button", { type: "button", onClick: () => { void run({ action: 'verify', draft }); }, children: local ? '检查安装与登录' : '验证连接并获取模型' }) }), !local && _jsxs("div", { className: css.fieldBlock, children: [_jsxs("div", { className: css.fieldHeader, children: [_jsx("label", { htmlFor: "qs-model-ids", children: "\u6A21\u578B ID\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF1B\u65E0\u6CD5\u53D1\u73B0\u65F6\u53EF\u624B\u52A8\u8865\u5145\uFF09" }), _jsx("button", { type: "button", onClick: () => {
                                                        setAdvancedModels(undefined);
                                                        setDraft({ ...draft, modelIds: [...MODEL_ID_TEMPLATE] });
                                                    }, children: "\u586B\u5165 ID \u6A21\u677F" })] }), _jsx("textarea", { id: "qs-model-ids", rows: Math.min(6, Math.max(2, draft.modelIds.length)), value: draft.modelIds.join('\n'), placeholder: 'your-model-id\nyour-model-id-fast', onChange: event => { setAdvancedModels(undefined); setDraft({ ...draft, modelIds: event.target.value.split('\n') }); } }), _jsx("small", { children: "\u8BF7\u66FF\u6362\u4E3A\u5382\u5546\u63A7\u5236\u53F0\u6216\u6A21\u578B\u76EE\u5F55\u8FD4\u56DE\u7684\u7CBE\u786E ID\uFF1B\u6A21\u677F\u5185\u5BB9\u4E0D\u80FD\u76F4\u63A5\u7528\u4E8E\u771F\u5B9E\u8C03\u7528\u3002" })] }), !local && draft.modelIds.length > 0 && _jsxs("section", { className: css.fieldBlock, "aria-label": "\u6A21\u578B\u80FD\u529B\u914D\u7F6E", children: [_jsxs("div", { className: css.fieldHeader, children: [_jsx("label", { children: "\u6A21\u578B\u80FD\u529B\u914D\u7F6E" }), _jsx("small", { children: "\u65E0\u9700\u586B\u5199 JSON\uFF0C\u53EF\u76F4\u63A5\u9009\u62E9" })] }), _jsx("p", { children: "\u8FDE\u63A5\u9A8C\u8BC1\u540E\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u5E26\u5165\u6A21\u578B\u3002\u65E0\u6CD5\u786E\u5B9A\u7684\u9879\u76EE\u4FDD\u6301\u201C\u81EA\u52A8\u68C0\u6D4B\u201D\uFF0C\u4FDD\u5B58\u540E\u53EF\u7528\u201C\u63A8\u7406\u6D4B\u8BD5\u201D\u786E\u8BA4\u3002" }), _jsx("div", { className: css.capabilityTable, children: currentProfiles.map(profile => {
                                                const status = profileReasoning(profile);
                                                return _jsxs("div", { className: css.capabilityRow, children: [_jsx("strong", { children: profile.id }), _jsxs("label", { children: ["\u601D\u8003\u80FD\u529B", _jsxs("select", { "aria-label": `${profile.id} 思考能力`, value: status, onChange: event => { const value = event.target.value; updateProfile(profile.id, value); }, children: [_jsx("option", { value: "unknown", children: "\u81EA\u52A8\u68C0\u6D4B" }), _jsx("option", { value: "supported", children: "\u652F\u6301\u601D\u8003" }), _jsx("option", { value: "unsupported", children: "\u4E0D\u652F\u6301" })] })] })] }, profile.id);
                                            }) })] }), !local && _jsxs("details", { children: [_jsx("summary", { children: "\u9AD8\u7EA7\u8BBE\u7F6E" }), _jsxs("label", { children: ["\u663E\u793A\u540D\u79F0", _jsx("input", { value: draft.name, onChange: event => { setDraft({ ...draft, name: event.target.value }); } })] }), draft.service !== 'custom' && _jsxs("label", { children: ["\u670D\u52A1\u5730\u5740", _jsx("input", { type: "url", value: draft.baseURL, onChange: event => { setDraft({ ...draft, baseURL: event.target.value }); } })] }), _jsxs("label", { children: ["API \u534F\u8BAE", _jsxs("select", { value: draft.api, onChange: event => { setDraft({ ...draft, api: event.target.value }); }, children: [_jsx("option", { value: "openai-completions", children: "OpenAI Chat Completions \u517C\u5BB9" }), _jsx("option", { value: "openai-responses", children: "OpenAI Responses" }), _jsx("option", { value: "anthropic-messages", children: "Anthropic Messages" }), _jsx("option", { value: "google-generative-ai", children: "Google Generative AI" })] })] }), _jsxs("div", { className: css.fieldBlock, children: [_jsxs("div", { className: css.fieldHeader, children: [_jsx("label", { htmlFor: "qs-model-capabilities", children: "\u6A21\u578B\u80FD\u529B\u8986\u76D6\uFF08JSON\uFF1B\u672A\u7F16\u8F91\u5219\u4FDD\u7559\u73B0\u6709\u914D\u7F6E\uFF09" }), _jsx("button", { type: "button", onClick: () => {
                                                                const ids = draft.modelIds.map(id => id.trim()).filter(Boolean);
                                                                if (ids.length === 0) {
                                                                    setError('请先填写至少一个模型 ID，再生成能力模板。');
                                                                    return;
                                                                }
                                                                setError('');
                                                                setAdvancedModels(capabilityTemplate(ids, draft.api));
                                                            }, children: "\u6309\u6A21\u578B ID \u751F\u6210\u6A21\u677F" })] }), _jsx("textarea", { id: "qs-model-capabilities", rows: 10, value: advancedModels ?? data?.connections.find(c => c.route === draft.route)?.modelsJson ?? JSON.stringify(draft.modelIds.filter(id => id.trim()).map(id => ({ id: id.trim() })), null, 2), placeholder: capabilityTemplate(['your-model-id'], draft.api), onChange: event => { setAdvancedModels(event.target.value); } }), _jsxs("div", { className: css.templateHelp, children: [_jsx("strong", { children: "\u5173\u952E\u53C2\u6570\u600E\u4E48\u586B" }), _jsxs("p", { children: [_jsx("code", { children: "input" }), " \u586B ", _jsx("code", { children: "[\"text\"]" }), "\uFF1B\u5382\u5546\u786E\u8BA4\u652F\u6301\u56FE\u7247\u65F6\u6539\u4E3A ", _jsx("code", { children: "[\"text\", \"image\"]" }), "\u3002"] }), _jsxs("p", { children: [_jsx("code", { children: "reasoningEfforts: false" }), " \u8868\u793A\u4E0D\u652F\u6301\u601D\u8003\uFF1B\u5BF9\u8C61\u8868\u793A\u652F\u6301\u601D\u8003\u5F00\u5173\u4E0E\u5F3A\u5EA6\u3002\u952E\u4F7F\u7528 ", _jsx("code", { children: "off / low / medium / high" }), "\uFF0C\u503C\u5FC5\u987B\u6539\u6210\u5382\u5546 API \u5B9E\u9645\u63A5\u6536\u7684\u62FC\u5199\u3002"] }), _jsxs("p", { children: [_jsx("code", { children: "off: null" }), " \u8868\u793A\u5173\u95ED\u65F6\u4E0D\u53D1\u9001\u601D\u8003\u5F3A\u5EA6\u3002OpenAI Chat Completions \u517C\u5BB9\u670D\u52A1\u53EA\u6709\u5728\u786E\u8BA4\u652F\u6301 ", _jsx("code", { children: "reasoning_effort" }), " \u540E\uFF0C\u624D\u4FDD\u7559 ", _jsx("code", { children: "supportsReasoningEffort: true" }), "\u3002"] })] })] }), _jsx("p", { children: "\u53EA\u586B\u5199\u5382\u5546\u5DF2\u786E\u8BA4\u652F\u6301\u7684\u80FD\u529B\u3002\u66F4\u6362\u5730\u5740\u6216\u534F\u8BAE\u9700\u91CD\u65B0\u8F93\u5165\u5BC6\u94A5\uFF0C\u65E7\u5BC6\u94A5\u4E0D\u4F1A\u88AB\u53D1\u5F80\u65B0\u5730\u5740\u3002" })] }), service?.docs && _jsxs("p", { children: [_jsx("a", { href: service.docs, target: "_blank", rel: "noreferrer", children: "\u5382\u5546\u5B98\u65B9\u63A5\u5165\u8BF4\u660E" }), " \u00B7 \u9884\u7F6E\u9002\u914D\u4E0D\u4EE3\u8868\u5DF2\u5B8C\u6210\u5B9E\u8D26\u53F7\u9A8C\u6536\u3002"] }), _jsx("button", { type: "submit", children: busy ? '处理中…' : '验证并保存' })] }) })] }), !adding && data && _jsxs("div", { className: css.connections, children: [data.connections.length === 0 && _jsx("p", { children: "\u5C1A\u672A\u6DFB\u52A0\u6A21\u578B\u670D\u52A1\u3002\u9009\u62E9\u5382\u5546\u5E76\u586B\u5199\u5BC6\u94A5\u5373\u53EF\u5F00\u59CB\u3002" }), data.connections.map(connection => _jsxs("section", { "aria-label": connection.name, children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("h3", { children: connection.name }), _jsxs("small", { children: [stateLabel[connection.state] ?? '待验证', " \u00B7 ", connection.modelIds.length, " \u4E2A\u5DF2\u914D\u7F6E\u6A21\u578B"] })] }), _jsx("button", { type: "button", disabled: busy, onClick: () => { edit(connection); }, children: "\u7BA1\u7406" })] }), _jsx("p", { children: connection.message }), _jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", disabled: busy, onClick: () => {
                                            void run({ action: 'verify', draft: { route: connection.route, service: connection.service, name: connection.name,
                                                    baseURL: connection.baseURL, api: connection.api, auto: connection.auto, modelIds: connection.modelIds, ...connection.reasoning === undefined ? {} : { reasoning: connection.reasoning } } });
                                        }, children: "\u68C0\u67E5\u8FDE\u63A5" }), _jsx("button", { type: "button", disabled: busy || !connection.modelIds.length, onClick: () => { setTesting(connection); setTestModel(connection.modelIds[0] ?? ''); }, children: "\u63A8\u7406\u6D4B\u8BD5" }), connection.service !== 'codex-local' && _jsx("button", { type: "button", disabled: busy, onClick: () => { setDeleteRoute(connection.route); }, children: "\u79FB\u9664\u8FDE\u63A5" })] }), deleteRoute === connection.route && _jsxs("div", { role: "alert", children: [_jsxs("p", { children: ["\u5C06\u79FB\u9664 ", connection.name, " \u7684 ", connection.modelIds.length, " \u4E2A\u6A21\u578B\u3002\u73B0\u6709\u4F1A\u8BDD\u7684\u6A21\u578B\u5F15\u7528\u4E0D\u4F1A\u9759\u9ED8\u66FF\u6362\uFF0C\u5171\u7528\u51ED\u636E\u4ECD\u4FDD\u7559\u3002"] }), _jsx("button", { type: "button", disabled: busy, onClick: () => { void run({ action: 'remove', route: connection.route }); }, children: "\u786E\u8BA4\u79FB\u9664" }), _jsx("button", { type: "button", disabled: busy, onClick: () => { setDeleteRoute(undefined); }, children: "\u53D6\u6D88" })] })] }, connection.route))] }), testing && _jsxs("section", { className: css.editor, "aria-label": "\u786E\u8BA4\u63A8\u7406\u6D4B\u8BD5", children: [_jsxs("h3", { children: ["\u6D4B\u8BD5 ", testing.name] }), _jsx("p", { children: "\u5C06\u53D1\u9001\u56FA\u5B9A\u6D4B\u8BD5\u6587\u672C\uFF0C\u4E0D\u542B\u4F1A\u8BDD\u6216\u5DE5\u4F5C\u533A\u5185\u5BB9\u3002\u53EF\u80FD\u6D88\u8017 API \u989D\u5EA6\u6216\u8BA2\u9605\u7528\u91CF\u3002" }), _jsx("select", { "aria-label": "\u6D4B\u8BD5\u6A21\u578B", value: testModel, onChange: event => { setTestModel(event.target.value); }, children: testing.modelIds.map(id => _jsx("option", { children: id }, id)) }), _jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", disabled: busy, onClick: () => { void run({ action: 'test', route: testing.route, model: testModel }); }, children: "\u5F00\u59CB\u771F\u5B9E\u63A8\u7406\u6D4B\u8BD5" }), _jsx("button", { type: "button", disabled: busy, onClick: () => { setTesting(undefined); }, children: "\u53D6\u6D88" })] })] })] });
}
//# sourceMappingURL=QuantSkillsModelServices.js.map