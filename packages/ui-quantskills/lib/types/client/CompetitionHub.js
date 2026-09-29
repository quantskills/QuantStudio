import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FlaskIcon, TrophyIcon } from '@phosphor-icons/react';
import { ContestPage } from "./ContestPage.js";
import { FactorContestPage } from "./FactorContestPage.js";
import styles from './FactorContestPage.module.css';
export function CompetitionHub(props) {
    const [kind, setKind] = useState(() => sessionStorage.getItem('quantstudio-competition') === 'factor' ? 'factor' : 'futures');
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    return _jsxs("div", { className: styles.hub, children: [_jsx("nav", { className: styles.selector, "aria-label": "\u9009\u62E9\u6BD4\u8D5B", hidden: workspaceOpen && kind === 'futures', children: [['futures', '期货模拟赛'], ['factor', '第四届因子大赛']].map(([value, label]) => _jsxs("button", { type: "button", "aria-pressed": kind === value, onClick: () => { sessionStorage.setItem('quantstudio-competition', value); setKind(value); }, children: [value === 'futures' ? _jsx(TrophyIcon, { size: 21 }) : _jsx(FlaskIcon, { size: 21 }), _jsx("span", { children: label })] }, value)) }), _jsx("div", { className: styles.body, children: kind === 'factor' ? _jsx(FactorContestPage, { access: props.factorAccess }) : _jsx(ContestPage, { ...props, onWorkspaceChange: setWorkspaceOpen }) })] });
}
//# sourceMappingURL=CompetitionHub.js.map