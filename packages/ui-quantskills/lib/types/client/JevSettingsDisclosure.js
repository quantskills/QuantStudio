import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CaretDownIcon } from '@phosphor-icons/react';
import './JevSettings.css';
export function JevSettingsDisclosure({ title, description, icon, badge, open, children, compact = false }) {
    return _jsxs("details", { className: "qs-jev-settings-disclosure", "data-compact": compact || undefined, open: open, children: [_jsxs("summary", { children: [_jsx("span", { className: "qs-jev-disclosure-icon", "aria-hidden": "true", children: icon }), _jsxs("span", { className: "qs-jev-disclosure-copy", children: [_jsx("strong", { children: title }), description && _jsx("small", { children: description })] }), badge && _jsx("span", { className: "qs-jev-disclosure-badge", children: badge }), _jsx(CaretDownIcon, { className: "qs-jev-disclosure-chevron", size: 16, "aria-hidden": "true" })] }), _jsx("div", { className: "qs-jev-disclosure-body", children: children })] });
}
//# sourceMappingURL=JevSettingsDisclosure.js.map