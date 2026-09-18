import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { watchActions } from "./ContestWatchVisuals.js";
import css from './ContestPage.module.css';
const defaults = { hold: '证据不足、信号不清或维持持仓更合适时观望。', open_long: '空仓且现有证据支持时建议开多。', open_short: '空仓且现有证据支持时建议开空。', close_long: '多头依据失效或已有证据支持退出时建议平多。', close_short: '空头依据失效或已有证据支持退出时建议平空。' };
export function JevStrategy({ config, onChange }) {
    const [error, setError] = useState('');
    return _jsxs("div", { className: css.watchInstructions, children: [_jsxs("label", { children: ["\u7B56\u7565\u540D\u79F0", _jsx("input", { maxLength: 80, value: config.strategyName ?? '自定义策略', onChange: event => onChange({ ...config, strategyName: event.target.value }) })] }), _jsxs("label", { children: ["\u7814\u7A76\u76EE\u6807\u548C\u7EA6\u675F", _jsx("textarea", { required: true, maxLength: 2000, value: config.instructions, onChange: event => onChange({ ...config, instructions: event.target.value }) })] }), _jsxs("details", { className: css.jevHistory, open: config.customStrategy || undefined, children: [_jsx("summary", { children: "\u5B9A\u5236\u5404\u52A8\u4F5C\u5224\u65AD\u6807\u51C6" }), Object.entries(watchActions).map(([action, label]) => _jsxs("label", { children: [label, "\u6807\u51C6", _jsx("textarea", { required: true, maxLength: 1000, value: config.actionCriteria?.[action] ?? defaults[action], onChange: event => onChange({ ...config, actionCriteria: { ...config.actionCriteria, [action]: event.target.value } }) })] }, action))] }), _jsxs("label", { children: ["\u53C2\u8003\u8D44\u6599", _jsx("textarea", { maxLength: 12000, value: config.referenceMaterial ?? '', placeholder: "\u7C98\u8D34\u7B56\u7565\u8BF4\u660E\u3001\u5E26\u65E5\u671F\u7684\u7814\u7A76\u8BB0\u5F55\u6216\u9000\u51FA\u6761\u4EF6\u3002\u8BF7\u5199\u660E\u6765\u6E90\u548C\u65F6\u95F4\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u8BFB\u53D6\u94FE\u63A5\u3002", onChange: event => onChange({ ...config, referenceMaterial: event.target.value }) })] }), _jsxs("label", { children: ["\u5BFC\u5165\u6587\u672C\u8D44\u6599\uFF08.txt / .md\uFF0C\u6700\u591A 12000 \u5B57\u7B26\uFF09", _jsx("input", { type: "file", accept: ".txt,.md,text/plain,text/markdown", onChange: event => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            setError('');
                            if (!file)
                                return;
                            if (!/\.(txt|md)$/i.test(file.name) || file.size > 64000) {
                                setError('请选择不超过 64 KB 的 TXT 或 Markdown 文本。');
                                return;
                            }
                            void file.text().then(text => {
                                if (text.length > 12000 || text.includes('\0')) {
                                    setError('资料须为纯文本，且不超过 12000 字符。');
                                    return;
                                }
                                onChange(current => ({ ...current, referenceMaterial: text }));
                            }).catch(() => setError('文件读取失败，请重试。'));
                        } })] }), error && _jsx("p", { className: css.error, role: "alert", children: error }), _jsx("p", { className: css.jevFine, children: "\u53C2\u8003\u8D44\u6599\u4F1A\u968F\u51B3\u7B56\u53D1\u9001\u7ED9 TypeSafe\u3002\u5386\u53F2 K \u7EBF\u6765\u81EA\u4E0B\u65B9\u6240\u9009\u6570\u636E\u6E90\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u6293\u53D6\u53C2\u8003\u6587\u672C\u4E2D\u7684\u94FE\u63A5\u6216\u65B0\u95FB\u3002\u6A21\u578B\u56FA\u5B9A\u4E3A jev-1.13.0\uFF1B\u5F53\u524D API \u672A\u63D0\u4F9B temperature\u3001top_p \u6216\u8BAD\u7EC3\u53C2\u6570\u3002" })] });
}
//# sourceMappingURL=JevStrategy.js.map