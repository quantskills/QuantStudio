import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useContest } from "./contest.js";
import { ContestPlans } from "./ContestPlans.js";
import { waitForCompetition } from "./competition-async.js";
import FlyV2Page from "./fly/FlyV2Page.js";
export function FlyPage({ access, contest, openContest, openModelSettings }) {
    const [state, setState] = useState(), [error, setError] = useState('');
    const [blenderPath, setBlenderPath] = useState('');
    useEffect(() => {
        if (!access)
            return;
        let disposed = false;
        let timer;
        const poll = async () => {
            try {
                const result = await waitForCompetition(() => access.status(), '果蝇状态读取', 15_000);
                if (!disposed) {
                    setState(result);
                    setError('');
                }
            }
            catch (error) {
                if (!disposed)
                    setError(String(error));
            }
            finally {
                if (!disposed)
                    timer = setTimeout(() => void poll(), 2000);
            }
        };
        void poll();
        return () => { disposed = true; clearTimeout(timer); };
    }, [access]);
    if (!access)
        return _jsxs("div", { className: "fv-page", children: [_jsx("h1", { children: "\u679C\u8747\u4EA4\u6613\u5458" }), _jsx("p", { children: "\u679C\u8747\u670D\u52A1\u5C1A\u672A\u8FDE\u63A5\uFF0C\u8BF7\u91CD\u542F QuantStudio\u3002" })] });
    if (!state?.installed)
        return _jsxs("div", { className: "fv-page", children: [_jsx("h1", { children: "\u7ED9\u5C0F\u679C\u4E00\u4E2A\u5BB6" }), _jsx("p", { children: "\u795E\u7ECF\u611F\u77E5\u30013D \u5BB6\u56ED\u548C\u5B66\u4E60\u8BB0\u5F55\u4FDD\u5B58\u5728\u672C\u673A\uFF1B\u4EA4\u6613\u63A5\u5165\u4F60\u7684\u671F\u8D27\u6A21\u62DF\u8D5B\u8D26\u6237\u3002" }), _jsx("p", { children: "\u70B9\u51FB\u4E00\u6B21\u5373\u53EF\u4F9D\u6B21\u51C6\u5907\u63A7\u5236\u5668\u3001\u795E\u7ECF Python \u4E0E MaleCNS\uFF1B\u4F1A\u663E\u793A\u8FDB\u5EA6\uFF0C\u5B8C\u6210\u540E\u8FDB\u5165\u9996\u6B21\u8BBE\u7F6E\u3002" }), _jsxs("label", { children: ["\u5DF2\u6709 Blender \u5B89\u88C5\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09", _jsx("input", { value: blenderPath, onChange: event => setBlenderPath(event.target.value), placeholder: "\u5B89\u88C5\u76EE\u5F55\u6216 blender.exe \u7684\u5B8C\u6574\u8DEF\u5F84" })] }), _jsx("p", { role: "status", children: state?.message ?? '正在检查运行环境…' }), error && _jsx("p", { role: "alert", children: error }), state && !state.supported ? _jsx("p", { children: "\u5F53\u524D\u679C\u8747\u7248\u672C\u652F\u6301 Windows\u3002" }) : _jsx("button", { type: "button", className: "fv-primary", disabled: !state || state.installing, onClick: () => { void access.install({ blenderPath: blenderPath.trim() }).then(setState).catch(error => setError(String(error))); }, children: state?.installing ? '正在准备…' : '一键准备果蝇' })] });
    return _jsxs("div", { className: "quantstudio-fly", children: [_jsxs("div", { className: "fv-contest-banner", children: [_jsx("span", { children: "\u671F\u8D27\u6A21\u62DF\u8D5B \u00B7 \u6BCF\u7B14\u4EA4\u6613\u9700\u786E\u8BA4" }), _jsx("a", { href: "#fly-contest-plans", children: "\u67E5\u770B\u4EA4\u6613\u8BA1\u5212" }), _jsx("button", { type: "button", onClick: openContest, children: "\u6BD4\u8D5B\u8D26\u6237" }), openModelSettings && _jsx("button", { type: "button", onClick: openModelSettings, children: "\u6A21\u578B\u670D\u52A1\u4E0E Jev API Key" })] }), _jsx(FlyV2Page, { active: true, contest: contest, openModelSettings: openModelSettings, preparing: state.installing, prepareMessage: state.message, onPrepare: path => access.install({ blenderPath: path }), tradePlans: contest && _jsx(FlyPlans, { access: contest }) })] });
}
function FlyPlans({ access }) {
    const state = useContest(access);
    if (!state.status)
        return null;
    const filtered = { ...state.status, plans: state.status.plans.filter(plan => plan.sessionId.startsWith('fly:')) };
    const pending = filtered.plans.filter(plan => plan.status === 'prepared').length;
    return _jsxs("details", { id: "fly-contest-plans", className: "fv-contest-plans", open: pending > 0, children: [_jsxs("summary", { children: ["\u5F85\u786E\u8BA4\u4EA4\u6613\u8BA1\u5212 \u00B7 ", pending, " \u7B14"] }), _jsx("p", { children: "\u6838\u5BF9\u8D26\u6237\u3001\u5408\u7EA6\u4E0E\u624B\u6570\u540E\u9010\u7B14\u786E\u8BA4\u3002\u505C\u6B62\u5EFA\u8BAE\u4E0D\u4F1A\u64A4\u9500\u5DF2\u63D0\u4EA4\u7684\u59D4\u6258\u3002" }), _jsx(ContestPlans, { status: filtered, access: access, refresh: state.refresh })] });
}
//# sourceMappingURL=FlyPage.js.map