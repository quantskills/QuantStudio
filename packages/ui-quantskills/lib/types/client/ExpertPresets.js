import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { EXPERT_PRESETS, PRESET_GROUPS, findPresetExpert, presetRequest } from "./expert-presets.js";
import css from './ExpertPresets.module.css';
export function ExpertPresets(props) {
    const [group, setGroup] = useState('all');
    const [created, setCreated] = useState([]);
    const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
    const locked = useRef(false);
    const definitions = [...props.definitions, ...created];
    const savedCount = EXPERT_PRESETS.filter(item => findPresetExpert(item, definitions)).length;
    const ensure = async (preset) => {
        const existing = findPresetExpert(preset, definitions);
        if (existing)
            return existing;
        const saved = await props.create(presetRequest(preset, props.versions));
        setCreated(current => [...current.filter(item => item.agentId !== saved.agentId), saved]);
        return saved;
    };
    const run = async (id, task) => {
        if (locked.current || !props.ready)
            return;
        locked.current = true;
        setBusy(id);
        setError('');
        setMessage('');
        try {
            await task();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '保存失败，请重试。已保存的专家会保留。');
        }
        finally {
            locked.current = false;
            setBusy('');
        }
    };
    return _jsxs("section", { className: css.library, "aria-label": "\u63A8\u8350\u4E13\u5BB6\u5E93", children: [_jsxs("header", { className: css.header, children: [_jsxs("div", { children: [_jsx("h2", { children: "\u9009\u4E00\u4F4D\u4E13\u5BB6\uFF0C\u5F00\u59CB\u5DE5\u4F5C" }), _jsx("p", { children: "\u6295\u8D44\u7814\u7A76\u3001\u91CF\u5316\u7814\u7A76\u4E0E\u65E5\u5E38\u529E\u516C\u5171 20 \u4F4D\uFF0C\u4FDD\u5B58\u540E\u53EF\u5728\u300C\u6211\u7684\u521B\u5EFA\u300D\u4E2D\u4FEE\u6539\u3001\u6536\u85CF\u6216\u52A0\u5165\u4E13\u5BB6\u56E2\u3002" })] }), _jsx("button", { disabled: !props.ready || !!busy || savedCount === EXPERT_PRESETS.length, onClick: () => void run('all', async () => {
                            for (const preset of EXPERT_PRESETS)
                                await ensure(preset);
                            setMessage(`${EXPERT_PRESETS.length} 位专家已保存，可在这里开始对话，也可到「我的创建」继续配置。`);
                        }), children: busy === 'all' ? '正在添加…' : savedCount === EXPERT_PRESETS.length ? '已全部添加' : '添加全部专家' })] }), _jsxs("div", { className: css.filters, "aria-label": "\u4E13\u5BB6\u7528\u9014", children: [[['all', `全部 ${EXPERT_PRESETS.length}`], ...Object.entries(PRESET_GROUPS).map(([id, label]) => [id, `${label} ${EXPERT_PRESETS.filter(item => item.group === id).length}`])].map(([id, label]) => _jsx("button", { "aria-pressed": group === id, onClick: () => setGroup(id), children: label }, id)), _jsxs("span", { children: ["\u5DF2\u6DFB\u52A0 ", savedCount, " / ", EXPERT_PRESETS.length] })] }), error && _jsx("p", { className: css.error, role: "alert", children: error }), message && _jsx("p", { role: "status", children: message }), _jsx("div", { className: css.grid, children: EXPERT_PRESETS.filter(preset => group === 'all' || preset.group === group).map(preset => {
                    const saved = findPresetExpert(preset, definitions), count = presetRequest(preset, props.versions).versionIds.length;
                    return _jsxs("article", { "data-group": preset.group, "aria-label": preset.name, children: [_jsxs("div", { className: css.title, children: [props.icon, _jsxs("div", { children: [_jsxs("small", { children: [PRESET_GROUPS[preset.group], preset.id === 'quant-research' ? ' · 不知道选谁，从这里开始' : ''] }), _jsx("h3", { children: preset.name })] })] }), _jsx("p", { className: css.summary, children: preset.summary }), _jsxs("blockquote", { children: [_jsx("small", { children: "\u8BD5\u8BD5\u8FD9\u6837\u95EE" }), preset.example] }), _jsxs("p", { className: css.output, children: [_jsx("b", { children: "\u4EA4\u4ED8" }), preset.output] }), _jsx("small", { className: css.status, children: saved ? `已保存 · ${saved.skills.length} 个绑定技能` : `${count} 个已安装技能可绑定 · 其余按任务检查` }), _jsxs("footer", { children: [_jsx("button", { className: css.primary, disabled: !props.ready || !!busy, onClick: () => void run(preset.id, async () => { await props.start(await ensure(preset)); }), children: busy === preset.id ? '正在准备…' : '开始新对话' }), saved ? _jsx("button", { disabled: !!busy, onClick: () => props.open(saved), children: "\u67E5\u770B\u914D\u7F6E" }) : _jsx("button", { disabled: !props.ready || !!busy, onClick: () => void run(preset.id, async () => { await ensure(preset); setMessage(`${preset.name}已添加到「我的创建」。`); }), children: "\u6DFB\u52A0\u4E13\u5BB6" })] })] }, preset.id);
                }) }), _jsx("p", { className: css.note, children: "\u6CBF\u7528\u5F53\u524D\u6A21\u578B\uFF0C\u4F7F\u7528\u6709\u9650\u6743\u9650\u3002\u9996\u6B21\u4F7F\u7528\u4F1A\u4FDD\u5B58\u4E13\u5BB6\u5E76\u7ED1\u5B9A\u73B0\u6709\u76F8\u5173\u6280\u80FD\uFF1B\u6570\u636E\u8FDE\u63A5\u548C\u53EF\u7528\u8303\u56F4\u4F1A\u5728\u5B9E\u9645\u4EFB\u52A1\u4E2D\u6838\u9A8C\u3002" })] });
}
//# sourceMappingURL=ExpertPresets.js.map