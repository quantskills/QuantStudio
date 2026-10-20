import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import css from './QuantSkillsApp.module.css';
/** Keep the native manager's slots and state owned by its registered main panel. */
export function PluginSettings({ openManager }) {
    const [error, setError] = useState();
    return _jsxs("section", { className: css.pluginSettings, children: [_jsxs("header", { children: [_jsx("h2", { children: "\u63D2\u4EF6\u7BA1\u7406" }), _jsx("p", { children: "\u67E5\u770B\u5DF2\u5B89\u88C5\u63D2\u4EF6\u3001\u5B98\u65B9\u6269\u5C55\u548C\u8FD0\u884C\u914D\u7F6E\u3002" }), _jsx("button", { type: "button", className: css.primaryButton, disabled: !openManager, onClick: () => {
                            try {
                                openManager?.();
                                setError(undefined);
                            }
                            catch {
                                setError('暂时无法打开插件管理，请刷新页面后重试。');
                            }
                        }, children: "\u6253\u5F00\u63D2\u4EF6\u7BA1\u7406" }), !openManager && _jsx("p", { role: "status", children: "\u63D2\u4EF6\u7BA1\u7406\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u540E\u5237\u65B0\u9875\u9762\u3002" }), error && _jsx("p", { role: "alert", children: error })] }), _jsxs("section", { "aria-label": "\u793E\u533A\u5E02\u573A", children: [_jsx("h3", { children: "\u793E\u533A\u5E02\u573A" }), _jsx("p", { children: "\u793E\u533A\u63D2\u4EF6\u5728\u63D2\u4EF6\u7BA1\u7406\u7684\u300C\u53D1\u73B0\u300D\u4E2D\u6D4F\u89C8\uFF0C\u5B89\u88C5\u3001\u66F4\u65B0\u548C\u5378\u8F7D\u7EDF\u4E00\u7531\u63D2\u4EF6\u7BA1\u7406\u5668\u5904\u7406\u3002" }), _jsx("p", { children: "\u9996\u6B21\u4F7F\u7528\u65F6\uFF0C\u5728\u300C\u5B98\u65B9\u6269\u5C55\u300D\u542F\u7528\u300C\u63D2\u4EF6\u5E02\u573A\u300D\u3002\u5DF2\u6709\u793E\u533A\u63D2\u4EF6\u7684\u6765\u6E90\u4E0E\u914D\u7F6E\u4F1A\u4FDD\u7559\u3002" })] })] });
}
//# sourceMappingURL=PluginSettings.js.map