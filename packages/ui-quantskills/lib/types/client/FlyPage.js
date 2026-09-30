import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useContest } from "./contest.js";
import { ContestPlans } from "./ContestPlans.js";
import { waitForCompetition } from "./competition-async.js";
import './TradingWorkspace.css';
import FlyV2Page from "./fly/FlyV2Page.js";
import './RefinedTrading.css';
export function FlyPage(props) {
    return _jsxs("div", { className: `qs-trader-shell${props.embedded ? ' qs-trader-embedded' : ''}`, children: [!props.embedded && _jsxs("div", { className: "qs-workspace-breadcrumb", children: [_jsx("button", { type: "button", className: "qs-return-contest", onClick: props.openContest, children: "\u2190 \u8FD4\u56DE\u6BD4\u8D5B\u9996\u9875" }), _jsx("span", { children: "/ AI \u4EA4\u6613\u5458" })] }), _jsx(FlyWorkspace, { ...props })] });
}
function FlyWorkspace({ access, contest, openContest, openModelSettings }) {
    const [state, setState] = useState(), [error, setError] = useState('');
    const [view, setView] = useState('dashboard');
    useEffect(() => {
        if (!access)
            return;
        let disposed = false;
        let timer;
        const poll = async () => {
            try {
                const result = await waitForCompetition(() => access.status(), 'AI 交易员状态读取', 15_000);
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
    }, [access, view]);
    const navigation = _jsx("nav", { className: "fv-nav", "aria-label": "AI \u4EA4\u6613\u5458\u680F\u76EE", children: [['dashboard', '交易'], ['analysis', '表现'], ['talk', '记录']].map(([key, label]) => _jsx("button", { type: "button", className: view === key ? 'selected' : '', "aria-current": view === key ? 'page' : undefined, onClick: () => setView(key), children: label }, key)) });
    const heading = _jsx("header", { className: "fv-header", children: _jsxs("div", { className: "fv-identity", children: [_jsx("div", { className: "fv-avatar", "aria-hidden": "true", children: _jsx("span", { className: "qs-trader-orb" }) }), _jsxs("h1", { children: ["AI \u4EA4\u6613\u5458", _jsx("span", { children: "\u8DDF\u8E2A\u6301\u4ED3\u3001\u6210\u4EA4\u4E0E\u6BCF\u6B21\u4EA4\u6613\u51B3\u7B56" })] })] }) });
    if (!access)
        return _jsxs("div", { className: "fv-page fv-workspace", children: [heading, navigation, _jsx("p", { children: "\u4EA4\u6613\u670D\u52A1\u5C1A\u672A\u8FDE\u63A5\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u540E\u67E5\u770B\u4EA4\u6613\u72B6\u6001\u3002" })] });
    if (!state?.installed)
        return _jsxs("div", { className: "fv-page fv-install", children: [heading, navigation, _jsx("div", { className: "fv-kicker", children: "QuantStudio \u00B7 AI \u4EA4\u6613\u5458" }), _jsx("h1", { children: "\u51C6\u5907\u4F60\u7684AI \u4EA4\u6613\u5458" }), _jsx("p", { children: "\u51C6\u5907\u8FD0\u884C\u73AF\u5883\u5E76\u8FDE\u63A5\u6BD4\u8D5B\u8D26\u6237\u540E\uFF0C\u5373\u53EF\u8BBE\u7F6E\u4EA4\u6613\u5458\u3002" }), _jsxs("section", { className: "fv-install-card", children: [_jsx("p", { children: "\u5148\u51C6\u5907\u8F7B\u91CF\u8FD0\u884C\u73AF\u5883\uFF0C\u5373\u53EF\u9009\u62E9 QS \u5DF2\u914D\u7F6E\u7684\u5927\u6A21\u578B\u3002\u9700\u8981\u795E\u7ECF\u4EA4\u6613\u5458\u65F6\uFF0C\u518D\u4ECE\u8BBE\u7F6E\u4E2D\u5B89\u88C5\u795E\u7ECF\u4F9D\u8D56\u3002" }), _jsx("p", { role: "status", children: state?.message ?? '正在检查运行环境…' }), error && _jsx("p", { role: "alert", children: error }), state && !state.supported ? _jsx("p", { children: "\u5F53\u524D\u4EA4\u6613\u8FD0\u884C\u73AF\u5883\u652F\u6301 Windows\u3002" }) : _jsx("button", { type: "button", className: "fv-primary", disabled: !state || state.installing, onClick: () => { void access.install({ neural: false }).then(setState).catch(error => setError(String(error))); }, children: state?.installing ? '正在准备…' : '准备交易环境' })] })] });
    return _jsx("div", { className: "quantstudio-fly", children: _jsx(FlyV2Page, { initialTab: view, active: true, contest: contest, openContest: openContest, openModelSettings: openModelSettings, preparing: state.installing, prepareMessage: state.message, onPrepare: () => access.install({ neural: true }), tradePlans: contest && _jsx(FlyPlans, { access: contest }) }) });
}
function FlyPlans({ access }) {
    const state = useContest(access);
    if (!state.status)
        return null;
    const identity = state.status.identity;
    const filtered = { ...state.status, plans: state.status.plans.filter(plan => plan.sessionId.startsWith('fly:')
            && plan.identity.accountId === identity?.accountId && plan.identity.contestId === identity?.contestId) };
    const pending = filtered.plans.filter(plan => ['prepared', 'executing', 'queued', 'submitted', 'unknown', 'partial'].includes(plan.status)).length;
    return _jsxs("details", { id: "fly-contest-plans", className: "fv-contest-plans", open: pending > 0, children: [_jsxs("summary", { children: ["\u4EA4\u6613\u8BA1\u5212\u4E0E\u56DE\u6267 \u00B7 ", pending, " \u7B14\u5F85\u5904\u7406"] }), _jsx("p", { children: "\u9010\u7B14\u786E\u8BA4\u7684\u8BA1\u5212\u9700\u8981\u6838\u5BF9\u540E\u63D0\u4EA4\uFF1B\u81EA\u52A8\u59D4\u6258\u76F4\u63A5\u5C55\u793A\u56DE\u6267\u3002\u6210\u4EA4\u4EE5\u67DC\u53F0\u8BB0\u5F55\u4E3A\u51C6\u3002" }), _jsx(ContestPlans, { status: filtered, access: access, refresh: state.refresh })] });
}
//# sourceMappingURL=FlyPage.js.map