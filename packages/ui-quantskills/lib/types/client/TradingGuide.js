import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useId, useState } from 'react';
import { CaretDownIcon, InfoIcon, QuestionIcon } from '@phosphor-icons/react';
import './TradingGuide.css';
import { ActionDialog } from "./ActionDialog.js";
/** Navigation and explanation only: opening a guide never starts a trading operation. */
export function TradingGuide({ name, steps, troubleshooting, compact = false, triggerIcon, inDrawer = false }) {
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
        return _jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "qs-quick-help", onClick: () => setHelp(true), children: [triggerIcon, "\u5FEB\u901F\u4E0A\u624B"] }), help && _jsx(ActionDialog, { drawer: true, className: "qs-support-drawer", title: `${name}快速上手`, onClose: () => setHelp(false), children: _jsx(TradingGuide, { inDrawer: true, name: name, steps: steps.map(item => ({ ...item, action: item.action ? { ...item.action, run: () => { setHelp(false); item.action.run(); } } : undefined })), troubleshooting: troubleshooting }) })] });
    return _jsxs("section", { className: "qs-trading-guide", "aria-label": `${name}新手引导`, children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("strong", { children: inDrawer ? '完成运行前的准备' : `${name} · 从这里开始` }), _jsx("span", { children: "\u6838\u5BF9\u914D\u7F6E\u4E0E\u884C\u60C5\uFF0C\u518D\u786E\u8BA4\u6267\u884C\u65B9\u5F0F\u3002" })] }), inDrawer ? _jsxs("span", { className: "qs-guide-step-count", children: [step + 1, " / ", steps.length, " \u6B65"] }) : _jsx("button", { type: "button", onClick: toggle, "aria-expanded": open, "aria-controls": id, children: open ? '收起新手引导' : '打开新手引导' })] }), (open || inDrawer) && _jsxs("div", { id: id, children: [_jsx("nav", { "aria-label": `${name}引导步骤`, children: steps.map((item, index) => _jsxs("button", { type: "button", "aria-current": step === index ? 'step' : undefined, onClick: () => setStep(index), children: [_jsx("span", { children: index + 1 }), _jsxs("div", { children: [_jsx("b", { children: item.title }), _jsx("small", { "data-ready": item.ready, children: item.status })] })] }, item.title)) }), _jsxs("div", { className: "qs-guide-body", children: [_jsxs("span", { className: "qs-guide-eyebrow", children: ["\u7B2C ", step + 1, " \u6B65"] }), _jsx("h3", { children: current.title }), _jsx("p", { children: current.body }), _jsxs("div", { className: "qs-guide-note", children: [_jsx(InfoIcon, { size: 16, "aria-hidden": "true" }), _jsx("p", { children: current.note })] }), _jsx("div", { className: "qs-guide-actions", children: current.action && _jsxs("button", { type: "button", className: "qs-guide-action", onClick: current.action.run, children: [current.action.label, " \u2197"] }) }), steps.length > 1 && _jsxs("div", { className: "qs-guide-paging", children: [_jsxs("span", { children: [step + 1, " / ", steps.length] }), _jsxs("div", { children: [step > 0 && _jsx("button", { type: "button", onClick: () => setStep(step - 1), children: "\u4E0A\u4E00\u6B65\u8BF4\u660E" }), step < steps.length - 1 && _jsx("button", { type: "button", onClick: () => setStep(step + 1), children: "\u4E0B\u4E00\u6B65\u8BF4\u660E \u2192" })] })] })] }), troubleshooting.length > 0 && _jsxs("section", { className: "qs-guide-help", "aria-label": "\u5E38\u89C1\u95EE\u9898", children: [_jsxs("header", { children: [_jsx(QuestionIcon, { size: 18, "aria-hidden": "true" }), _jsx("h3", { children: "\u5E38\u89C1\u95EE\u9898" }), _jsxs("span", { children: [troubleshooting.length, " \u9879"] })] }), troubleshooting.map(item => _jsxs("details", { children: [_jsxs("summary", { children: [_jsx("strong", { children: item.title }), _jsx(CaretDownIcon, { size: 15, "aria-hidden": "true" })] }), _jsx("p", { children: item.body })] }, item.title))] })] })] });
}
//# sourceMappingURL=TradingGuide.js.map