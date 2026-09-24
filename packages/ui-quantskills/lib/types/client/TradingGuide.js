import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from 'react';
import './TradingGuide.css';
import { ActionDialog } from "./ActionDialog.js";
/** Navigation and explanation only: opening a guide never starts a trading operation. */
export function TradingGuide({ name, steps, troubleshooting, compact = false }) {
    const [help, setHelp] = useState(false);
    const id = useId();
    const [open, setOpen] = useState(() => {
        try {
            return localStorage.getItem(`qs-guide-v1-${name}`) !== 'closed';
        }
        catch {
            return true;
        }
    });
    const [step, setStep] = useState(0);
    const current = steps[step];
    function toggle() {
        setOpen(!open);
        try {
            localStorage.setItem(`qs-guide-v1-${name}`, open ? 'closed' : 'open');
        }
        catch { /* Private browsing may disable storage. */ }
    }
    if (compact)
        return _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "qs-quick-help", onClick: () => setHelp(true), children: "\u5FEB\u901F\u4E0A\u624B" }), help && _jsx(ActionDialog, { drawer: true, title: `${name}快速上手`, onClose: () => setHelp(false), children: _jsx(TradingGuide, { name: name, steps: steps.map(item => ({ ...item, action: item.action ? { ...item.action, run: () => { setHelp(false); item.action.run(); } } : undefined })), troubleshooting: troubleshooting }) })] });
    return _jsxs("section", { className: "qs-trading-guide", "aria-label": `${name}新手引导`, children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsxs("strong", { children: [name, " \u00B7 \u4ECE\u8FD9\u91CC\u5F00\u59CB"] }), _jsx("span", { children: "\u914D\u7F6E \u2192 \u6838\u9A8C \u2192 \u8FD0\u884C \u2192 \u786E\u8BA4\u8BA1\u5212" })] }), _jsx("button", { type: "button", onClick: toggle, "aria-expanded": open, "aria-controls": id, children: open ? '收起新手引导' : '打开新手引导' })] }), open && _jsxs("div", { id: id, children: [_jsx("nav", { "aria-label": `${name}引导步骤`, children: steps.map((item, index) => _jsxs("button", { type: "button", "aria-current": step === index ? 'step' : undefined, onClick: () => setStep(index), children: [_jsx("span", { children: index + 1 }), _jsxs("div", { children: [_jsx("b", { children: item.title }), _jsx("small", { "data-ready": item.ready, children: item.status })] })] }, item.title)) }), _jsxs("div", { className: "qs-guide-body", children: [_jsx("h3", { children: current.title }), _jsx("p", { children: current.body }), _jsx("p", { className: "qs-guide-note", children: current.note }), _jsxs("div", { className: "qs-guide-actions", children: [current.action && _jsxs("button", { type: "button", onClick: current.action.run, children: [current.action.label, " \u2197"] }), step > 0 && _jsx("button", { type: "button", onClick: () => setStep(step - 1), children: "\u4E0A\u4E00\u6B65\u8BF4\u660E" }), step < steps.length - 1 && _jsx("button", { type: "button", onClick: () => setStep(step + 1), children: "\u4E0B\u4E00\u6B65\u8BF4\u660E \u2192" })] })] }), _jsxs("details", { className: "qs-guide-help", children: [_jsx("summary", { children: "\u5361\u5728\u67D0\u4E00\u6B65\uFF1F\u67E5\u770B\u5E38\u89C1\u95EE\u9898" }), troubleshooting.map(item => _jsxs("div", { children: [_jsx("b", { children: item.title }), _jsx("p", { children: item.body })] }, item.title))] })] })] });
}
//# sourceMappingURL=TradingGuide.js.map