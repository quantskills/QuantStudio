import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TradingWorkspace.css';
export function TradingSettingsNavigation({ current, items, onChange }) {
    return _jsx("nav", { className: "qs-settings-navigation", "aria-label": "\u8BBE\u7F6E\u680F\u76EE", children: items.map(item => _jsxs("button", { type: "button", "aria-label": item.title, "aria-current": current === item.id ? 'page' : undefined, onClick: () => onChange(item.id), children: [_jsx("strong", { children: item.title }), _jsx("small", { children: item.detail })] }, item.id)) });
}
//# sourceMappingURL=TradingNavigation.js.map