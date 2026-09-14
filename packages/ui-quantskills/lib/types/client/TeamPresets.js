import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { TEAM_PRESETS, expertPresetById, findPresetTeam, saveTeamPresets } from "./team-presets.js";
import css from './ExpertPresets.module.css';
import { PRESET_GROUPS } from "./expert-presets.js";
export function TeamPresets(props) {
    const [group, setGroup] = useState('all');
    const [experts, setExperts] = useState([]);
    const [created, setCreated] = useState([]);
    const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
    const locked = useRef(false);
    const teams = [...props.teams, ...created];
    const count = TEAM_PRESETS.filter(preset => findPresetTeam(preset, teams)).length;
    const ensure = (presets) => saveTeamPresets(presets, { ...props, definitions: [...props.definitions, ...experts], teams,
        savedExpert: expert => setExperts(current => [...current, expert]), savedTeam: team => setCreated(current => [...current, team]),
    });
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
            setError(`${cause instanceof Error ? cause.message : '保存失败，请重试。'} 已保存的专家和专家团会保留。`);
        }
        finally {
            locked.current = false;
            setBusy('');
        }
    };
    return _jsxs("section", { className: css.library, "aria-label": "\u63A8\u8350\u4E13\u5BB6\u56E2\u5E93", children: [_jsxs("header", { className: css.header, children: [_jsxs("div", { children: [_jsx("h2", { children: "\u5206\u5DE5\u660E\u786E\uFF0C\u4E00\u8D77\u5B8C\u6210\u5DE5\u4F5C" }), _jsx("p", { children: "\u8986\u76D6\u6295\u8D44\u7814\u7A76\u3001\u91CF\u5316\u7814\u7A76\u548C\u65E5\u5E38\u529E\u516C\uFF0C\u6309\u4EFB\u52A1\u5B89\u6392\u534F\u4F5C\u987A\u5E8F\u3002\u4FDD\u5B58\u540E\u53EF\u5728\u300C\u6211\u7684\u521B\u5EFA\u300D\u8C03\u6574\u6210\u5458\u3001\u6A21\u578B\u548C\u6D41\u7A0B\u3002" })] }), _jsx("button", { disabled: !props.ready || !!busy || count === TEAM_PRESETS.length, onClick: () => void run('all', async () => { await ensure(TEAM_PRESETS); setMessage(`${TEAM_PRESETS.length} 个专家团已保存，可以开始团队会话。`); }), children: busy === 'all' ? '正在添加…' : count === TEAM_PRESETS.length ? '已全部添加' : '添加全部专家团' })] }), _jsxs("div", { className: css.filters, "aria-label": "\u4E13\u5BB6\u56E2\u7528\u9014", children: [['all', ...Object.keys(PRESET_GROUPS)].map(id => _jsxs("button", { "aria-pressed": group === id, onClick: () => setGroup(id), children: [id === 'all' ? '全部' : PRESET_GROUPS[id], " ", TEAM_PRESETS.filter(item => id === 'all' || item.group === id).length] }, id)), _jsxs("span", { children: ["\u5DF2\u6DFB\u52A0 ", count, " / ", TEAM_PRESETS.length] })] }), error && _jsx("p", { className: css.error, role: "alert", children: error }), message && _jsx("p", { role: "status", children: message }), _jsx("div", { className: `${css.grid} ${css.teamGrid}`, children: TEAM_PRESETS.filter(preset => group === 'all' || preset.group === group).map(preset => {
                    const saved = findPresetTeam(preset, teams);
                    return _jsxs("article", { "data-group": preset.group, "aria-label": preset.name, children: [_jsxs("div", { className: css.title, children: [props.icon, _jsxs("div", { children: [_jsxs("small", { children: [PRESET_GROUPS[preset.group], " \u00B7 ", preset.members.length + 1, " \u4F4D\u4E13\u5BB6\u534F\u4F5C"] }), _jsx("h3", { children: preset.name })] })] }), _jsx("p", { className: css.summary, children: preset.summary }), _jsxs("div", { className: css.roster, children: [_jsxs("b", { children: ["\u8D1F\u8D23\u4EBA \u00B7 ", expertPresetById(preset.lead).name] }), preset.members.map(member => _jsx("span", { children: expertPresetById(member.expert).name }, member.expert))] }), _jsxs("blockquote", { children: [_jsx("small", { children: "\u8BD5\u8BD5\u8FD9\u6837\u95EE" }), preset.example] }), _jsxs("details", { className: css.teamSteps, children: [_jsx("summary", { children: "\u67E5\u770B\u5206\u5DE5\u4E0E\u6D41\u7A0B" }), _jsx("ol", { children: preset.stages.map(stage => _jsx("li", { children: stage }, stage)) }), preset.members.map(member => _jsxs("p", { children: [_jsxs("b", { children: [expertPresetById(member.expert).name, "\uFF1A"] }), member.responsibility] }, member.expert))] }), _jsxs("p", { className: css.output, children: [_jsx("b", { children: "\u4EA4\u4ED8" }), preset.output] }), _jsx("small", { className: css.status, children: saved ? '已保存 · 成员与技能版本已固定' : '自动复用已有专家，缺少的预设专家会一并添加' }), _jsxs("footer", { children: [_jsx("button", { className: css.primary, disabled: !props.ready || !!busy, onClick: () => void run(preset.id, async () => { const [team] = await ensure([preset]); if (team)
                                            await props.start(team); }), children: busy === preset.id ? '正在准备…' : '开始团队会话' }), saved ? _jsx("button", { disabled: !!busy, onClick: () => props.open(saved), children: "\u67E5\u770B\u914D\u7F6E" }) : _jsx("button", { disabled: !props.ready || !!busy, onClick: () => void run(preset.id, async () => { await ensure([preset]); setMessage(`${preset.name}已添加到「我的创建」。`); }), children: "\u6DFB\u52A0\u4E13\u5BB6\u56E2" })] })] }, preset.id);
                }) }), _jsx("p", { className: css.note, children: "\u6BCF\u6B21\u6309\u4F60\u7684\u5177\u4F53\u4EFB\u52A1\u534F\u4F5C\uFF1B\u6BCF\u65E5\u5E02\u573A\u7814\u7A76\u56E2\u4E0D\u4F1A\u81EA\u52A8\u521B\u5EFA\u5B9A\u65F6\u5B89\u6392\u3002\u6210\u5458\u9ED8\u8BA4\u4F7F\u7528\u72EC\u7ACB\u4E0A\u4E0B\u6587\u548C\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B\u3002" })] });
}
//# sourceMappingURL=TeamPresets.js.map