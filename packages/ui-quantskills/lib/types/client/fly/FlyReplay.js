import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { flyApi } from "./transport.js";
export function FlyReplayLab({ active }) {
    const [events, setEvents] = useState([]), [selected, setSelected] = useState(0), [error, setError] = useState('');
    const load = async (after = 0) => {
        try {
            const result = await flyApi(`events?after=${after}`);
            setEvents(result.events);
            setSelected(0);
            setError('');
        }
        catch (error) {
            setError(String(error));
        }
    };
    useEffect(() => { if (active)
        void load(); }, [active]);
    const event = events[selected];
    return _jsxs("section", { className: "fv-widget", children: [_jsxs("header", { children: [_jsx("h2", { children: "\u4E8B\u4EF6\u56DE\u653E" }), _jsx("button", { type: "button", onClick: () => void load(), children: "\u4ECE\u5934\u8BFB\u53D6" }), _jsx("button", { type: "button", disabled: !events.length, onClick: () => void load(events.at(-1).seq), children: "\u4E0B\u4E00\u9875" })] }), _jsxs("div", { className: "fv-widget-content", children: [_jsx("p", { children: "\u9010\u6761\u67E5\u770B\u4FDD\u5B58\u7684\u795E\u7ECF\u51B3\u7B56\u3001\u751F\u6D3B\u53CD\u9988\u548C\u67DC\u53F0\u56DE\u62A5\uFF1B\u56DE\u653E\u4E0D\u4F1A\u6267\u884C\u4EA4\u6613\u6216\u518D\u6B21\u5B66\u4E60\u3002" }), error && _jsx("p", { role: "alert", children: error }), events.length ? _jsxs(_Fragment, { children: [_jsx("input", { "aria-label": "\u56DE\u653E\u4F4D\u7F6E", type: "range", min: 0, max: events.length - 1, value: selected, onChange: e => setSelected(Number(e.target.value)) }), _jsxs("p", { children: ["#", event.seq, " \u00B7 ", new Date(event.at * 1000).toLocaleString('zh-CN'), " \u00B7 ", event.actor, " \u00B7 ", event.kind] }), _jsx("pre", { className: "fv-replay-json", children: JSON.stringify(event.payload, null, 2) })] }) : _jsx("p", { children: "\u6682\u65E0\u4FDD\u5B58\u7684\u4E8B\u4EF6\u3002" })] })] });
}
//# sourceMappingURL=FlyReplay.js.map