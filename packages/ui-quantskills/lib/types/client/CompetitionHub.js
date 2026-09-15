import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ContestPage } from "./ContestPage.js";
import { FactorContestPage } from "./FactorContestPage.js";
import styles from './FactorContestPage.module.css';
export function CompetitionHub(props) {
    const [kind, setKind] = useState(() => sessionStorage.getItem('quantstudio-competition') === 'factor' ? 'factor' : 'futures');
    return _jsxs("div", { className: styles.hub, children: [_jsx("nav", { className: styles.selector, "aria-label": "\u9009\u62E9\u6BD4\u8D5B", children: [['futures', '期货模拟赛'], ['factor', '第四届因子大赛']].map(([value, label]) => _jsx("button", { type: "button", "aria-pressed": kind === value, onClick: () => { sessionStorage.setItem('quantstudio-competition', value); setKind(value); }, children: label }, value)) }), _jsx("div", { className: styles.body, children: kind === 'factor' ? _jsx(FactorContestPage, { access: props.factorAccess }) : _jsx(ContestPage, { ...props }) })] });
}
//# sourceMappingURL=CompetitionHub.js.map