import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CaretRightIcon, ChartLineIcon, ReceiptIcon, WalletIcon } from '@phosphor-icons/react';
const icons = { market: ChartLineIcon, plans: ReceiptIcon, account: WalletIcon };
export function TraderDisclosure({ kind, title, description, status, tone = 'neutral', open, id, children }) {
    const Icon = icons[kind];
    return _jsxs("details", { className: "qs-trader-disclosure", "data-kind": kind, open: open, id: id, children: [_jsxs("summary", { children: [_jsx("span", { className: "qs-trader-disclosure-icon", "aria-hidden": "true", children: _jsx(Icon, { size: 21 }) }), _jsxs("span", { className: "qs-trader-disclosure-copy", children: [_jsx("strong", { children: title }), _jsx("span", { children: description })] }), _jsx("span", { className: "qs-trader-disclosure-status", "data-tone": tone, children: status }), _jsx(CaretRightIcon, { className: "qs-trader-disclosure-chevron", size: 16, "aria-hidden": "true" })] }), _jsx("div", { className: "qs-trader-disclosure-content", children: children })] });
}
//# sourceMappingURL=TraderDisclosure.js.map